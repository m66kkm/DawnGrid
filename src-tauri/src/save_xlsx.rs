use std::path::Path;
use rust_xlsxwriter::{
    Color, Format, FormatAlign, FormatUnderline, Workbook, Worksheet,
};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveCellData {
    pub r: u32,
    pub c: u16,
    pub v: Option<serde_json::Value>,
    pub f: Option<String>,
    pub style: Option<SaveCellStyle>,
}

#[derive(Debug, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveCellStyle {
    pub bold: Option<bool>,
    pub italic: Option<bool>,
    pub underline: Option<bool>,
    pub strike: Option<bool>,
    pub font_size: Option<f64>,
    pub font_family: Option<String>,
    pub font_color: Option<String>,
    pub bg_color: Option<String>,
    pub num_format: Option<String>,
    pub wrap_text: Option<bool>,
    pub align_h: Option<String>,
    pub align_v: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveMergeRange {
    pub start_row: u32,
    pub start_col: u16,
    pub end_row: u32,
    pub end_col: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveColWidth {
    pub col: u16,
    pub width: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveRowHeight {
    pub row: u32,
    pub height: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFreeze {
    pub row: u32,
    pub col: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveSheetData {
    pub name: String,
    pub show_grid_lines: Option<bool>,
    pub freeze: Option<SaveFreeze>,
    pub col_widths: Vec<SaveColWidth>,
    pub row_heights: Vec<SaveRowHeight>,
    pub merges: Vec<SaveMergeRange>,
    pub cells: Vec<SaveCellData>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkbookPayload {
    pub path: String,
    pub sheets: Vec<SaveSheetData>,
}

fn parse_hex_color(color_str: &str) -> Option<Color> {
    let s = color_str.trim().trim_start_matches('#');
    if s.len() == 6 {
        if let Ok(rgb) = u32::from_str_radix(s, 16) {
            return Some(Color::RGB(rgb));
        }
    } else if s.len() == 8 {
        // e.g. RRGGBBAA or AARRGGBB - take first 6
        if let Ok(rgb) = u32::from_str_radix(&s[..6], 16) {
            return Some(Color::RGB(rgb));
        }
    } else if s.len() == 3 {
        let r = &s[0..1];
        let g = &s[1..2];
        let b = &s[2..3];
        let full = format!("{r}{r}{g}{g}{b}{b}");
        if let Ok(rgb) = u32::from_str_radix(&full, 16) {
            return Some(Color::RGB(rgb));
        }
    }
    None
}

fn build_format(style: &SaveCellStyle) -> Format {
    let mut fmt = Format::new();

    if style.bold == Some(true) {
        fmt = fmt.set_bold();
    }
    if style.italic == Some(true) {
        fmt = fmt.set_italic();
    }
    if style.underline == Some(true) {
        fmt = fmt.set_underline(FormatUnderline::Single);
    }
    if style.strike == Some(true) {
        fmt = fmt.set_font_strikethrough();
    }
    if let Some(fs) = style.font_size {
        if fs > 0.0 {
            fmt = fmt.set_font_size(fs);
        }
    }
    if let Some(ref ff) = style.font_family {
        if !ff.is_empty() {
            fmt = fmt.set_font_name(ff);
        }
    }
    if let Some(ref fc) = style.font_color {
        if let Some(color) = parse_hex_color(fc) {
            fmt = fmt.set_font_color(color);
        }
    }
    if let Some(ref bg) = style.bg_color {
        if let Some(color) = parse_hex_color(bg) {
            fmt = fmt.set_background_color(color);
        }
    }
    if let Some(ref nf) = style.num_format {
        if !nf.is_empty() {
            fmt = fmt.set_num_format(nf);
        }
    }
    if style.wrap_text == Some(true) {
        fmt = fmt.set_text_wrap();
    }
    if let Some(ref ah) = style.align_h {
        match ah.as_str() {
            "left" => fmt = fmt.set_align(FormatAlign::Left),
            "center" => fmt = fmt.set_align(FormatAlign::Center),
            "right" => fmt = fmt.set_align(FormatAlign::Right),
            _ => {}
        }
    }
    if let Some(ref av) = style.align_v {
        match av.as_str() {
            "top" => fmt = fmt.set_align(FormatAlign::Top),
            "center" => fmt = fmt.set_align(FormatAlign::VerticalCenter),
            "bottom" => fmt = fmt.set_align(FormatAlign::Bottom),
            _ => {}
        }
    }

    fmt
}

pub fn save_workbook_to_path(payload: &SaveWorkbookPayload) -> Result<(), String> {
    if payload.path.to_lowercase().ends_with(".csv") {
        return crate::csv_handler::save_csv_to_path(payload);
    }

    let mut workbook = Workbook::new();

    if payload.sheets.is_empty() {
        return Err("Cannot save empty workbook with no sheets.".to_string());
    }

    for sheet_data in &payload.sheets {
        let mut worksheet = Worksheet::new();
        let _ = worksheet.set_name(&sheet_data.name);

        if let Some(grid) = sheet_data.show_grid_lines {
            worksheet.set_screen_gridlines(grid);
        }

        if let Some(ref freeze) = sheet_data.freeze {
            if freeze.row > 0 || freeze.col > 0 {
                let _ = worksheet.set_freeze_panes(freeze.row, freeze.col);
            }
        }

        for cw in &sheet_data.col_widths {
            if cw.width > 0.0 {
                let _ = worksheet.set_column_width(cw.col, cw.width);
            }
        }

        for rh in &sheet_data.row_heights {
            if rh.height > 0.0 {
                let _ = worksheet.set_row_height(rh.row, rh.height);
            }
        }

        // Apply merges first
        for m in &sheet_data.merges {
            if m.end_row >= m.start_row && m.end_col >= m.start_col {
                if m.start_row != m.end_row || m.start_col != m.end_col {
                    let _ = worksheet.merge_range(
                        m.start_row,
                        m.start_col,
                        m.end_row,
                        m.end_col,
                        "",
                        &Format::new(),
                    );
                }
            }
        }

        // Write cells
        for cell in &sheet_data.cells {
            let format = cell.style.as_ref().map(build_format);

            if let Some(ref formula) = cell.f {
                let clean_formula = formula.trim().trim_start_matches('=');
                if let Some(ref fmt) = format {
                    let _ = worksheet.write_formula_with_format(
                        cell.r,
                        cell.c,
                        clean_formula,
                        fmt,
                    );
                } else {
                    let _ = worksheet.write_formula(cell.r, cell.c, clean_formula);
                }
            } else if let Some(ref val) = cell.v {
                match val {
                    serde_json::Value::Number(num) => {
                        if let Some(f) = num.as_f64() {
                            if let Some(ref fmt) = format {
                                let _ = worksheet.write_number_with_format(cell.r, cell.c, f, fmt);
                            } else {
                                let _ = worksheet.write_number(cell.r, cell.c, f);
                            }
                        }
                    }
                    serde_json::Value::Bool(b) => {
                        if let Some(ref fmt) = format {
                            let _ = worksheet.write_boolean_with_format(cell.r, cell.c, *b, fmt);
                        } else {
                            let _ = worksheet.write_boolean(cell.r, cell.c, *b);
                        }
                    }
                    serde_json::Value::String(s) => {
                        if let Some(ref fmt) = format {
                            let _ = worksheet.write_string_with_format(cell.r, cell.c, s, fmt);
                        } else {
                            let _ = worksheet.write_string(cell.r, cell.c, s);
                        }
                    }
                    serde_json::Value::Null => {
                        if let Some(ref fmt) = format {
                            let _ = worksheet.write_blank(cell.r, cell.c, fmt);
                        }
                    }
                    other => {
                        let s = other.to_string();
                        if let Some(ref fmt) = format {
                            let _ = worksheet.write_string_with_format(cell.r, cell.c, &s, fmt);
                        } else {
                            let _ = worksheet.write_string(cell.r, cell.c, &s);
                        }
                    }
                }
            } else if let Some(ref fmt) = format {
                let _ = worksheet.write_blank(cell.r, cell.c, fmt);
            }
        }

        workbook.push_worksheet(worksheet);
    }

    workbook
        .save(Path::new(&payload.path))
        .map_err(|e| format!("保存 Excel 文件失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_save_workbook() {
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join(format!("dawngrid_test_{}.xlsx", std::process::id()));

        let payload = SaveWorkbookPayload {
            path: test_path.to_string_lossy().to_string(),
            sheets: vec![
                SaveSheetData {
                    name: "销售统计".to_string(),
                    show_grid_lines: Some(true),
                    freeze: Some(SaveFreeze { row: 1, col: 0 }),
                    col_widths: vec![
                        SaveColWidth { col: 0, width: 15.0 },
                        SaveColWidth { col: 1, width: 20.0 },
                    ],
                    row_heights: vec![
                        SaveRowHeight { row: 0, height: 25.0 },
                    ],
                    merges: vec![
                        SaveMergeRange {
                            start_row: 0,
                            start_col: 0,
                            end_row: 0,
                            end_col: 1,
                        },
                    ],
                    cells: vec![
                        SaveCellData {
                            r: 0,
                            c: 0,
                            v: Some(serde_json::Value::String("季度销售总览".to_string())),
                            f: None,
                            style: Some(SaveCellStyle {
                                bold: Some(true),
                                font_size: Some(16.0),
                                font_color: Some("#107c41".to_string()),
                                bg_color: Some("#f0fdf4".to_string()),
                                align_h: Some("center".to_string()),
                                align_v: Some("center".to_string()),
                                ..Default::default()
                            }),
                        },
                        SaveCellData {
                            r: 1,
                            c: 0,
                            v: Some(serde_json::Value::Number(serde_json::Number::from_f64(1234.56).unwrap())),
                            f: None,
                            style: Some(SaveCellStyle {
                                num_format: Some("#,##0.00".to_string()),
                                ..Default::default()
                            }),
                        },
                        SaveCellData {
                            r: 1,
                            c: 1,
                            v: None,
                            f: Some("SUM(A1:A10)".to_string()),
                            style: None,
                        },
                    ],
                },
            ],
        };

        let res = save_workbook_to_path(&payload);
        assert!(res.is_ok(), "Failed to save: {:?}", res.err());
        assert!(test_path.exists(), "Saved file does not exist");
        let metadata = fs::metadata(&test_path).unwrap();
        assert!(metadata.len() > 0, "Saved file is empty");

        // Clean up
        let _ = fs::remove_file(&test_path);
    }
}

