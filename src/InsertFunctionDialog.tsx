import { useState } from "react";

interface InsertFunctionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (formula: string) => void;
}

const FUNCTIONS = [
  { name: "SUM", cat: "常用", syntax: "SUM(number1, [number2], ...)", desc: "计算单元格区域中所有数值的和。" },
  { name: "AVERAGE", cat: "常用", syntax: "AVERAGE(number1, [number2], ...)", desc: "返回参数的算术平均值。" },
  { name: "COUNT", cat: "常用", syntax: "COUNT(value1, [value2], ...)", desc: "计算包含数字的单元格以及参数列表中数字的个数。" },
  { name: "MAX", cat: "常用", syntax: "MAX(number1, [number2], ...)", desc: "返回一组值中的最大值。" },
  { name: "MIN", cat: "常用", syntax: "MIN(number1, [number2], ...)", desc: "返回一组值中的最小值。" },
  { name: "IF", cat: "逻辑", syntax: "IF(logical_test, [value_if_true], [value_if_false])", desc: "指定要执行的逻辑测试，若为真返回一个值，若为假返回另一个值。" },
  { name: "AND", cat: "逻辑", syntax: "AND(logical1, [logical2], ...)", desc: "如果所有参数均为 TRUE，则返回 TRUE。" },
  { name: "OR", cat: "逻辑", syntax: "OR(logical1, [logical2], ...)", desc: "如果任一参数为 TRUE，则返回 TRUE。" },
  { name: "VLOOKUP", cat: "查找与引用", syntax: "VLOOKUP(lookup_value, table_array, col_index_num, [range_lookup])", desc: "在表格或区域的第一列中查找指定值，并返回该行中其他列的值。" },
  { name: "INDEX", cat: "查找与引用", syntax: "INDEX(array, row_num, [column_num])", desc: "返回表格或区域中指定行和列交叉处的单元格引用或值。" },
  { name: "MATCH", cat: "查找与引用", syntax: "MATCH(lookup_value, lookup_array, [match_type])", desc: "返回在指定方式下与指定数组中查找值匹配的元素的相应位置。" },
  { name: "CONCATENATE", cat: "文本", syntax: "CONCATENATE(text1, [text2], ...)", desc: "将几个文本项合并为一个文本项。" },
  { name: "LEFT", cat: "文本", syntax: "LEFT(text, [num_chars])", desc: "返回文本字符串中从左开始指定个数的字符。" },
  { name: "RIGHT", cat: "文本", syntax: "RIGHT(text, [num_chars])", desc: "返回文本字符串中从右开始指定个数的字符。" },
  { name: "LEN", cat: "文本", syntax: "LEN(text)", desc: "返回文本字符串中的字符数。" },
  { name: "TODAY", cat: "日期与时间", syntax: "TODAY()", desc: "返回当前日期的序列号。" },
  { name: "NOW", cat: "日期与时间", syntax: "NOW()", desc: "返回当前日期和时间的序列号。" },
  { name: "YEAR", cat: "日期与时间", syntax: "YEAR(serial_number)", desc: "返回某日期的年份。" },
];

export function InsertFunctionDialog({
  isOpen,
  onClose,
  onInsert,
}: InsertFunctionDialogProps) {
  const [selectedCat, setSelectedCat] = useState("常用");
  const [selectedFn, setSelectedFn] = useState(FUNCTIONS[0]);
  const [search, setSearch] = useState("");

  if (!isOpen) return null;

  const categories = ["全部", "常用", "逻辑", "查找与引用", "文本", "日期与时间"];

  const filtered = FUNCTIONS.filter((fn) => {
    const matchCat = selectedCat === "全部" || fn.cat === selectedCat;
    const matchSearch = !search || fn.name.toLowerCase().includes(search.toLowerCase()) || fn.desc.includes(search);
    return matchCat && matchSearch;
  });

  function handleSelect() {
    if (selectedFn) {
      onInsert(`=${selectedFn.name}()`);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window insert-func-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>插入函数 (Insert Function)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="dialog-body">
          <div className="search-filter-row">
            <input
              type="text"
              className="dialog-input"
              placeholder="搜索函数名或描述..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="dialog-select"
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="func-list-container">
            <ul className="func-list">
              {filtered.map((fn) => (
                <li
                  key={fn.name}
                  className={`func-item ${selectedFn.name === fn.name ? "active" : ""}`}
                  onClick={() => setSelectedFn(fn)}
                  onDoubleClick={handleSelect}
                >
                  <span className="fn-name">{fn.name}</span>
                  <span className="fn-cat">{fn.cat}</span>
                </li>
              ))}
            </ul>
          </div>

          {selectedFn && (
            <div className="func-detail-card">
              <div className="func-syntax">{selectedFn.syntax}</div>
              <div className="func-desc">{selectedFn.desc}</div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="button" className="dialog-btn primary" onClick={handleSelect}>
              插入函数
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
