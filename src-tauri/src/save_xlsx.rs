use std::path::Path;
use rust_xlsxwriter::{
    Chart, ChartDataLabel, ChartDataLabelPosition, ChartLegendPosition, ChartPoint,
    ChartSolidFill, ChartType, Color, Format, FormatAlign, FormatUnderline, Workbook, Worksheet,
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

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveMergeRange {
    pub start_row: u32,
    pub end_row: u32,
    pub start_col: u16,
    pub end_col: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveFreeze {
    pub row: u32,
    pub col: u16,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavePointColor {
    pub index: usize,
    pub color: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveChartSeries {
    pub name: Option<String>,
    pub values_ref: Option<String>,
    pub categories_ref: Option<String>,
    #[serde(default)]
    pub values: Vec<f64>,
    #[serde(default)]
    pub categories: Vec<String>,
    pub color: Option<String>,
    #[serde(default)]
    pub point_colors: Vec<SavePointColor>,
    pub explosion_pct: Option<u32>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveChartValueAxis {
    pub min: Option<f64>,
    pub max: Option<f64>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SaveChartData {
    pub id: String,
    pub title: Option<String>,
    pub chart_type: String,
    pub bar_direction: Option<String>,
    pub grouping: Option<String>,
    pub sheet_id: String,
    pub sheet_name: Option<String>,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub legend: Option<String>,
    pub data_labels: Option<String>,
    pub data_label_position: Option<String>,
    pub data_label_format: Option<String>,
    pub gridlines: Option<bool>,
    pub value_axis: Option<SaveChartValueAxis>,
    pub hole_size_pct: Option<u32>,
    pub gap_width_pct: Option<u32>,
    #[serde(default)]
    pub series: Vec<SaveChartSeries>,
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
    #[serde(default)]
    pub charts: Vec<SaveChartData>,
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

        // Insert charts belonging to this worksheet
        for chart_data in &sheet_data.charts {
            let chart_type = match chart_data.chart_type.as_str() {
                "pie" | "pieChart" => ChartType::Pie,
                "doughnut" | "doughnutChart" => ChartType::Doughnut,
                "line" | "lineChart" => match chart_data.grouping.as_deref() {
                    Some("stacked") => ChartType::LineStacked,
                    Some("percentStacked") => ChartType::LinePercentStacked,
                    _ => ChartType::Line,
                },
                "area" | "areaChart" => match chart_data.grouping.as_deref() {
                    Some("stacked") => ChartType::AreaStacked,
                    Some("percentStacked") => ChartType::AreaPercentStacked,
                    _ => ChartType::Area,
                },
                "bar" => match chart_data.grouping.as_deref() {
                    Some("stacked") => ChartType::BarStacked,
                    Some("percentStacked") => ChartType::BarPercentStacked,
                    _ => ChartType::Bar,
                },
                "barChart" => {
                    if chart_data.bar_direction.as_deref() == Some("bar") {
                        match chart_data.grouping.as_deref() {
                            Some("stacked") => ChartType::BarStacked,
                            Some("percentStacked") => ChartType::BarPercentStacked,
                            _ => ChartType::Bar,
                        }
                    } else {
                        match chart_data.grouping.as_deref() {
                            Some("stacked") => ChartType::ColumnStacked,
                            Some("percentStacked") => ChartType::ColumnPercentStacked,
                            _ => ChartType::Column,
                        }
                    }
                }
                "scatter" | "scatterChart" => ChartType::Scatter,
                "radar" | "radarChart" => ChartType::Radar,
                _ => match chart_data.grouping.as_deref() {
                    Some("stacked") => ChartType::ColumnStacked,
                    Some("percentStacked") => ChartType::ColumnPercentStacked,
                    _ => ChartType::Column,
                },
            };

            let mut chart = Chart::new(chart_type);
            if let Some(ref title) = chart_data.title {
                if !title.trim().is_empty() {
                    chart.title().set_name(title);
                }
            }

            // Legend position and visibility
            if let Some(ref leg) = chart_data.legend {
                match leg.to_lowercase().as_str() {
                    "none" => {
                        chart.legend().set_hidden();
                    }
                    "top" | "t" => {
                        chart.legend().set_position(ChartLegendPosition::Top);
                    }
                    "bottom" | "b" => {
                        chart.legend().set_position(ChartLegendPosition::Bottom);
                    }
                    "left" | "l" => {
                        chart.legend().set_position(ChartLegendPosition::Left);
                    }
                    "topright" | "tr" => {
                        chart.legend().set_position(ChartLegendPosition::TopRight);
                    }
                    _ => {
                        chart.legend().set_position(ChartLegendPosition::Right);
                    }
                }
            }

            // Gridlines
            if let Some(gl) = chart_data.gridlines {
                chart.y_axis().set_major_gridlines(gl);
            }

            // Value axis bounds
            if let Some(ref va) = chart_data.value_axis {
                if let Some(min) = va.min {
                    chart.y_axis().set_min(min);
                }
                if let Some(max) = va.max {
                    chart.y_axis().set_max(max);
                }
            }

            // Doughnut hole size
            if let Some(hole) = chart_data.hole_size_pct {
                if hole > 0 && hole < 100 {
                    chart.set_hole_size(hole as u8);
                }
            }

            let is_pie_or_doughnut = matches!(chart_type, ChartType::Pie | ChartType::Doughnut);

            for (s_idx, s) in chart_data.series.iter().enumerate() {
                // Excel pie/doughnut charts only support a single series
                if is_pie_or_doughnut && s_idx > 0 {
                    break;
                }

                let series = chart.add_series();
                if let Some(ref name) = s.name {
                    if !name.trim().is_empty() {
                        series.set_name(name);
                    }
                }

                // Categories: prioritize formula ref
                if let Some(ref cat_ref) = s.categories_ref {
                    let clean_ref = cat_ref.trim_start_matches('=');
                    if !clean_ref.trim().is_empty() {
                        series.set_categories(clean_ref);
                    }
                }

                // Values: prioritize formula ref
                if let Some(ref val_ref) = s.values_ref {
                    let clean_ref = val_ref.trim_start_matches('=');
                    if !clean_ref.trim().is_empty() {
                        series.set_values(clean_ref);
                    }
                }

                // Series solid fill color
                if let Some(ref color) = s.color {
                    if !color.trim().is_empty() && color != "none" {
                        let mut fill = ChartSolidFill::new();
                        fill.set_color(color.as_str());
                        series.set_format(&mut fill);
                    }
                }

                // Point colors (especially for Pie and Doughnut slices)
                if !s.point_colors.is_empty() {
                    let max_idx = s.point_colors.iter().map(|p| p.index).max().unwrap_or(0);
                    let color_map: std::collections::HashMap<usize, &String> =
                        s.point_colors.iter().map(|p| (p.index, &p.color)).collect();
                    let mut points = Vec::new();
                    for i in 0..=max_idx {
                        let mut pt = ChartPoint::new();
                        if let Some(col) = color_map.get(&i) {
                            if !col.trim().is_empty() && col.as_str() != "none" {
                                let mut fill = ChartSolidFill::new();
                                fill.set_color(col.as_str());
                                pt = pt.set_format(&mut fill);
                            }
                        }
                        points.push(pt);
                    }
                    series.set_points(&points);
                }

                // Data Labels
                if let Some(ref dl_mode) = chart_data.data_labels {
                    if dl_mode != "none" && !dl_mode.is_empty() {
                        let mut dl = ChartDataLabel::new();
                        match dl_mode.as_str() {
                            "percent" => {
                                dl.show_percentage();
                            }
                            "category-percent" => {
                                dl.show_category_name().show_percentage();
                            }
                            "category-value-percent" => {
                                dl.show_category_name().show_value().show_percentage();
                            }
                            "category-value" => {
                                dl.show_category_name().show_value();
                            }
                            "series-value" => {
                                dl.show_series_name().show_value();
                            }
                            _ => {
                                dl.show_value();
                            }
                        }

                        // Position
                        if let Some(ref pos) = chart_data.data_label_position {
                            match pos.as_str() {
                                "center" => {
                                    dl.set_position(ChartDataLabelPosition::Center);
                                }
                                "inside-end" | "insideEnd" => {
                                    dl.set_position(ChartDataLabelPosition::InsideEnd);
                                }
                                "inside-base" | "insideBase" => {
                                    dl.set_position(ChartDataLabelPosition::InsideBase);
                                }
                                "outside-end" | "outsideEnd" => {
                                    dl.set_position(ChartDataLabelPosition::OutsideEnd);
                                }
                                "best-fit" | "bestFit" => {
                                    dl.set_position(ChartDataLabelPosition::BestFit);
                                }
                                _ => {}
                            }
                        }

                        // Number format
                        if let Some(ref fmt) = chart_data.data_label_format {
                            if !fmt.trim().is_empty() {
                                dl.set_num_format(fmt.trim());
                            }
                        }

                        series.set_data_label(&dl);
                    }
                }
            }

            if chart_data.width > 50.0 {
                chart.set_width(chart_data.width as u32);
            }
            if chart_data.height > 50.0 {
                chart.set_height(chart_data.height as u32);
            }

            let col = (chart_data.x / 72.0).max(0.0) as u16;
            let row = (chart_data.y / 20.0).max(0.0) as u32;
            let x_offset = (chart_data.x % 72.0) as u32;
            let y_offset = (chart_data.y % 20.0) as u32;

            let _ = worksheet.insert_chart_with_offset(row, col, &chart, x_offset, y_offset);
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
                    charts: vec![],
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

    #[test]
    fn test_save_and_reopen_pie_chart() {
        let temp_dir = std::env::temp_dir();
        let test_path = temp_dir.join(format!("dawngrid_test_pie_{}.xlsx", std::process::id()));

        let payload = SaveWorkbookPayload {
            path: test_path.to_string_lossy().to_string(),
            sheets: vec![
                SaveSheetData {
                    name: "Sheet1".to_string(),
                    show_grid_lines: Some(true),
                    freeze: None,
                    col_widths: vec![],
                    row_heights: vec![],
                    merges: vec![],
                    cells: vec![
                        SaveCellData {
                            r: 0,
                            c: 0,
                            v: Some(serde_json::Value::String("类别".to_string())),
                            f: None,
                            style: None,
                        },
                        SaveCellData {
                            r: 0,
                            c: 1,
                            v: Some(serde_json::Value::String("数值".to_string())),
                            f: None,
                            style: None,
                        },
                        SaveCellData {
                            r: 1,
                            c: 0,
                            v: Some(serde_json::Value::String("产品A".to_string())),
                            f: None,
                            style: None,
                        },
                        SaveCellData {
                            r: 1,
                            c: 1,
                            v: Some(serde_json::Value::Number(serde_json::Number::from_f64(100.0).unwrap())),
                            f: None,
                            style: None,
                        },
                        SaveCellData {
                            r: 2,
                            c: 0,
                            v: Some(serde_json::Value::String("产品B".to_string())),
                            f: None,
                            style: None,
                        },
                        SaveCellData {
                            r: 2,
                            c: 1,
                            v: Some(serde_json::Value::Number(serde_json::Number::from_f64(200.0).unwrap())),
                            f: None,
                            style: None,
                        },
                    ],
                    charts: vec![
                        SaveChartData {
                            id: "chart-pie-1".to_string(),
                            title: Some("销售饼图".to_string()),
                            chart_type: "pieChart".to_string(),
                            bar_direction: None,
                            grouping: None,
                            sheet_id: "Sheet1".to_string(),
                            sheet_name: Some("Sheet1".to_string()),
                            x: 100.0,
                            y: 80.0,
                            width: 500.0,
                            height: 320.0,
                            legend: Some("right".to_string()),
                            data_labels: Some("percent".to_string()),
                            data_label_position: Some("outsideEnd".to_string()),
                            data_label_format: Some("0.0%".to_string()),
                            gridlines: Some(false),
                            value_axis: None,
                            hole_size_pct: None,
                            gap_width_pct: None,
                            series: vec![
                                SaveChartSeries {
                                    name: Some("数值".to_string()),
                                    values_ref: Some("Sheet1!$B$2:$B$3".to_string()),
                                    categories_ref: Some("Sheet1!$A$2:$A$3".to_string()),
                                    values: vec![],
                                    categories: vec![],
                                    color: None,
                                    point_colors: vec![
                                        SavePointColor { index: 0, color: "#4F81BD".to_string() },
                                        SavePointColor { index: 1, color: "#C0504D".to_string() },
                                    ],
                                    explosion_pct: Some(10),
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        let res = save_workbook_to_path(&payload);
        assert!(res.is_ok(), "Failed to save: {:?}", res.err());
        assert!(test_path.exists(), "Saved file does not exist");

        // Reopen with xlsx-engine
        let mut sessions = xlsx_sidecar::WorkbookSessions::new();
        let meta = sessions.open(&test_path);
        assert!(meta.is_ok(), "Failed to open saved xlsx: {:?}", meta.err());
        let meta = meta.unwrap();

        assert_eq!(meta.visuals.len(), 1, "Should have 1 visual");
        let chart = meta.visuals[0].chart.as_ref().expect("Visual should have chart");
        assert_eq!(chart.chart_types, vec!["pieChart".to_string()], "Chart should be pieChart");
        assert_eq!(chart.title, "销售饼图");
        println!("Reopened chart data_labels: {:?}", chart.data_labels);
        println!("Reopened chart data_label_position: {:?}", chart.data_label_position);
        println!("Reopened chart legend: {:?}", chart.legend);
        println!("Reopened chart series count: {}", chart.series.len());
        if !chart.series.is_empty() {
            println!("Series[0] point_colors: {:?}", chart.series[0].point_colors);
        }

        // Clean up
        let _ = fs::remove_file(&test_path);
    }

}

