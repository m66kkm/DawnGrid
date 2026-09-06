use std::collections::HashMap;
use std::fs::File;
use std::io::Write;
use std::path::{Path, PathBuf};
use uuid::Uuid;
use xlsx_sidecar::{
    CellRange, CellRecord, CellValue, ColumnWidth, RangeResult, SheetMetadata, WorkbookMetadata,
};

pub struct CsvSession {
    pub path: PathBuf,
    pub rows: Vec<Vec<String>>,
    pub row_count: usize,
    pub col_count: usize,
}

pub struct CsvSessions {
    pub sessions: HashMap<String, CsvSession>,
}

impl CsvSessions {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn open(&mut self, path: &Path) -> Result<WorkbookMetadata, String> {
        let bytes = std::fs::read(path).map_err(|e| format!("读取 CSV 文件失败: {}", e))?;

        // Detect encoding
        let content = if bytes.starts_with(&[0xEF, 0xBB, 0xBF]) {
            // UTF-8 with BOM
            String::from_utf8_lossy(&bytes[3..]).into_owned()
        } else {
            // Try UTF-8
            match std::str::from_utf8(&bytes) {
                Ok(s) => s.to_string(),
                Err(_) => {
                    // Fallback to GB18030 / GBK (standard for Chinese CSV on Windows)
                    let (decoded, _, _) = encoding_rs::GB18030.decode(&bytes);
                    decoded.into_owned()
                }
            }
        };

        let mut rdr = csv::ReaderBuilder::new()
            .has_headers(false)
            .flexible(true)
            .from_reader(content.as_bytes());

        let mut rows: Vec<Vec<String>> = Vec::new();
        let mut col_count = 0usize;

        for result in rdr.records() {
            let record = result.map_err(|e| format!("解析 CSV 数据失败: {}", e))?;
            let row: Vec<String> = record.iter().map(|s| s.to_string()).collect();
            if row.len() > col_count {
                col_count = row.len();
            }
            rows.push(row);
        }

        let row_count = rows.len();
        if col_count == 0 {
            col_count = 1;
        }

        // Calculate approximate column widths based on cell text lengths
        let mut column_widths = Vec::new();
        for c in 0..col_count {
            let mut max_len = 8usize;
            for row in rows.iter().take(100) {
                if let Some(val) = row.get(c) {
                    let len = val.chars().count();
                    if len > max_len {
                        max_len = len;
                    }
                }
            }
            column_widths.push(ColumnWidth {
                start_column: c,
                end_column: c,
                width: Some((max_len.min(50).max(8) as f64) * 1.2),
                hidden: false,
                outline_level: None,
                collapsed: false,
                style_index: None,
            });
        }

        let session_id = format!("csv-{}", Uuid::new_v4());
        let file_name = path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or("data.csv")
            .to_string();

        let sheet_name = path
            .file_stem()
            .and_then(|v| v.to_str())
            .unwrap_or("Sheet1")
            .to_string();

        let sheet = SheetMetadata {
            id: "sheet-1".to_string(),
            name: sheet_name,
            row_count,
            column_count: col_count,
            source_xml_bytes: 0,
            column_widths,
            default_row_height: None,
            default_row_height_fixed: false,
            default_column_width: None,
            base_column_width: None,
            freeze: None,
            hidden: false,
            tab_color: None,
            show_grid_lines: true,
            show_formulas: false,
            show_row_col_headers: true,
            right_to_left: false,
            zoom_scale: None,
            tables: vec![],
            comments: vec![],
            pivot_ranges: vec![],
            pivot_tables: vec![],
            sparklines: vec![],
            print_area: None,
            print_titles: None,
            has_scoped_defined_names: false,
            cell_images: vec![],
        };

        let session = CsvSession {
            path: path.to_path_buf(),
            rows,
            row_count,
            col_count,
        };

        self.sessions.insert(session_id.clone(), session);

        Ok(WorkbookMetadata {
            session_id,
            name: file_name,
            entry_count: 1,
            sheets: vec![sheet],
            active_tab: 0,
            styles: vec![],
            dxf_styles: vec![],
            visuals: vec![],
            defined_names: vec![],
            theme_colors: None,
            theme_fonts: None,
            normal_font_name: None,
            workbook_protection: None,
            date1904: false,
            short_date_format: None,
        })
    }

    pub fn read_range(
        &self,
        session_id: &str,
        range: &CellRange,
    ) -> Result<RangeResult, String> {
        let session = self
            .sessions
            .get(session_id)
            .ok_or_else(|| "未找到 CSV 会话".to_string())?;

        let mut cells = Vec::new();

        let start_row = range.start_row;
        let end_row = range.end_row.min(session.row_count.saturating_sub(1));
        let start_col = range.start_column;
        let end_col = range.end_column.min(session.col_count.saturating_sub(1));

        if start_row <= end_row && start_col <= end_col {
            for r in start_row..=end_row {
                if let Some(row) = session.rows.get(r) {
                    for c in start_col..=end_col {
                        if let Some(val_str) = row.get(c) {
                            if val_str.is_empty() {
                                continue;
                            }
                            let value = parse_cell_value(val_str);
                            cells.push(CellRecord {
                                row: r,
                                column: c,
                                value: Some(value),
                                formula: None,
                                array_ref: None,
                                style_index: None,
                                rich: None,
                            });
                        }
                    }
                }
            }
        }

        let mut res = RangeResult::empty();
        res.cells = cells;
        res.indexing_complete = true;
        res.indexed_through_row = Some(session.row_count.saturating_sub(1));
        Ok(res)
    }

    pub fn close(&mut self, session_id: &str) -> Result<(), String> {
        self.sessions.remove(session_id);
        Ok(())
    }
}

fn parse_cell_value(text: &str) -> CellValue {
    let trimmed = text.trim();
    if trimmed.eq_ignore_ascii_case("true") {
        return CellValue::Boolean(true);
    }
    if trimmed.eq_ignore_ascii_case("false") {
        return CellValue::Boolean(false);
    }
    // Check if it can be parsed as f64 (avoid numbers with leading 0 like "00123" which are usually IDs/codes)
    if (trimmed == "0" || !trimmed.starts_with('0') || trimmed.starts_with("0."))
        && !trimmed.starts_with('+')
    {
        if let Ok(num) = trimmed.parse::<f64>() {
            if !num.is_nan() && !num.is_infinite() {
                return CellValue::Number(num);
            }
        }
    }
    CellValue::String(text.to_string())
}

pub fn save_csv_to_path(payload: &crate::save_xlsx::SaveWorkbookPayload) -> Result<(), String> {
    let sheet = payload
        .sheets
        .first()
        .ok_or_else(|| "工作簿中没有任何工作表".to_string())?;

    let mut max_r = 0u32;
    let mut max_c = 0u16;

    for cell in &sheet.cells {
        if cell.r > max_r {
            max_r = cell.r;
        }
        if cell.c > max_c {
            max_c = cell.c;
        }
    }

    let mut grid: Vec<Vec<String>> =
        vec![vec![String::new(); (max_c + 1) as usize]; (max_r + 1) as usize];

    for cell in &sheet.cells {
        let text = if let Some(ref f) = cell.f {
            if f.starts_with('=') {
                f.clone()
            } else {
                format!("={}", f)
            }
        } else if let Some(ref v) = cell.v {
            match v {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => String::new(),
                other => other.to_string(),
            }
        } else {
            String::new()
        };

        if (cell.r as usize) < grid.len() && (cell.c as usize) < grid[cell.r as usize].len() {
            grid[cell.r as usize][cell.c as usize] = text;
        }
    }

    let mut file = File::create(Path::new(&payload.path))
        .map_err(|e| format!("创建 CSV 文件失败: {}", e))?;

    // Write UTF-8 BOM so Excel opens Chinese CSV without garbled characters
    file.write_all(b"\xEF\xBB\xBF")
        .map_err(|e| format!("写入 CSV 编码头失败: {}", e))?;

    let mut writer = csv::WriterBuilder::new().from_writer(file);

    for row in grid {
        writer
            .write_record(&row)
            .map_err(|e| format!("写入 CSV 数据行失败: {}", e))?;
    }

    writer
        .flush()
        .map_err(|e| format!("保存 CSV 失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv_open_and_save() {
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join(format!("dawngrid_csv_test_{}.csv", std::process::id()));

        // Write a test CSV with Chinese and numbers
        let content = "商品名称,价格,数量\n华为手机,5999.00,10\n小米电视,2499.5,5\n";
        std::fs::write(&test_path, content.as_bytes()).unwrap();

        let mut sessions = CsvSessions::new();
        let meta = sessions.open(&test_path).expect("open failed");
        assert_eq!(meta.sheets.len(), 1);
        assert_eq!(meta.sheets[0].row_count, 3);
        assert_eq!(meta.sheets[0].column_count, 3);

        let range = CellRange {
            start_row: 0,
            end_row: 2,
            start_column: 0,
            end_column: 2,
        };
        let range_res = sessions.read_range(&meta.session_id, &range).expect("read_range failed");
        assert_eq!(range_res.cells.len(), 9);

        // Test save
        let save_payload = crate::save_xlsx::SaveWorkbookPayload {
            path: test_path.to_string_lossy().to_string(),
            sheets: vec![crate::save_xlsx::SaveSheetData {
                name: "Sheet1".to_string(),
                show_grid_lines: Some(true),
                freeze: None,
                col_widths: vec![],
                row_heights: vec![],
                merges: vec![],
                cells: vec![
                    crate::save_xlsx::SaveCellData {
                        r: 0,
                        c: 0,
                        v: Some(serde_json::Value::String("姓名".to_string())),
                        f: None,
                        style: None,
                    },
                    crate::save_xlsx::SaveCellData {
                        r: 0,
                        c: 1,
                        v: Some(serde_json::Value::Number(serde_json::Number::from(100))),
                        f: None,
                        style: None,
                    },
                ],
            }],
        };

        save_csv_to_path(&save_payload).expect("save_csv failed");
        let saved_bytes = std::fs::read(&test_path).unwrap();
        // Starts with BOM
        assert!(saved_bytes.starts_with(b"\xEF\xBB\xBF"));

        let _ = std::fs::remove_file(&test_path);
    }
}
