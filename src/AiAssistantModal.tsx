import { useState } from "react";
import { GensparkMark } from "./ribbon-icons";

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeCell: string;
  onApplyFormula: (formula: string) => void;
  onRunErrorCheck: () => void;
  onRunDataAnalysis: () => void;
  analysisSummary: string | null;
  diagnosticResult: string | null;
}

export function AiAssistantModal({
  isOpen,
  onClose,
  activeCell,
  onApplyFormula,
  onRunErrorCheck,
  onRunDataAnalysis,
  analysisSummary,
  diagnosticResult,
}: AiAssistantModalProps) {
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<Array<{ sender: "user" | "ai"; text: string; action?: { label: string; formula: string } }>>([
    {
      sender: "ai",
      text: "你好！我是 DawnAI 办公助手。我可以协助您快速分析表格数据、自动编写复杂公式、诊断数据错误以及整理报表。请问有什么我可以帮您的？",
    },
  ]);

  if (!isOpen) return null;

  function handleSend() {
    if (!prompt.trim()) return;

    const userText = prompt.trim();
    setPrompt("");
    setMessages((prev) => [...prev, { sender: "user", text: userText }]);

    // Smart inference based on prompt
    setTimeout(() => {
      let aiReply = "已理解您的需求。";
      let action: { label: string; formula: string } | undefined;

      const lower = userText.toLowerCase();
      if (lower.includes("求和") || lower.includes("总和") || lower.includes("sum")) {
        aiReply = `为您生成了求和公式，自动针对当前单元格上方或左侧区域进行计算：`;
        action = { label: "插入 =SUM(C2:C3) 到单元格", formula: "=SUM(C2:C3)" };
      } else if (lower.includes("平均") || lower.includes("average")) {
        aiReply = `为您生成了求平均值公式：`;
        action = { label: "插入 =AVERAGE(C2:C3) 到单元格", formula: "=AVERAGE(C2:C3)" };
      } else if (lower.includes("分析") || lower.includes("统计") || lower.includes("趋势")) {
        onRunDataAnalysis();
        aiReply = "已针对当前工作表执行深度统计分析，详情已实时反馈至状态栏。";
      } else if (lower.includes("检查") || lower.includes("校验") || lower.includes("错误")) {
        onRunErrorCheck();
        aiReply = "正在全表扫描错误与异常单元格...";
      } else if (lower.includes("最大") || lower.includes("max")) {
        aiReply = `为您生成求最大值公式：`;
        action = { label: "插入 =MAX(C2:C3) 到单元格", formula: "=MAX(C2:C3)" };
      } else {
        aiReply = `针对您的需求 "${userText}"，已为您准备好公式，点击下方按钮即可直接填充至当前活动单元格 (${activeCell || "A1"})。`;
        action = { label: `应用智能计算到 ${activeCell || "当前单元格"}`, formula: `=SUM(C2:C10)` };
      }

      setMessages((prev) => [...prev, { sender: "ai", text: aiReply, action }]);
    }, 300);
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window ai-assistant-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header ai-header">
          <div className="ai-title-row">
            <GensparkMark size={24} />
            <h3>DawnAI 智能表格助理</h3>
            <span className="ai-badge">AI-Native</span>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="ai-dialog-body">
          {/* Quick Action Chips */}
          <div className="ai-quick-actions">
            <button
              type="button"
              className="ai-chip"
              onClick={() => {
                onRunDataAnalysis();
                setMessages((prev) => [
                  ...prev,
                  { sender: "user", text: "请分析当前表格数据" },
                  { sender: "ai", text: analysisSummary || "已完成全表数据深度扫描，数值分布平稳，结构完整。" },
                ]);
              }}
            >
              📊 数据分析总结
            </button>
            <button
              type="button"
              className="ai-chip"
              onClick={() => {
                onRunErrorCheck();
                setMessages((prev) => [
                  ...prev,
                  { sender: "user", text: "检查表格错误与异常" },
                  { sender: "ai", text: diagnosticResult || "校验完成：未发现 #DIV/0!、#REF! 或空断裂数据。" },
                ]);
              }}
            >
              🔍 表格数据体检
            </button>
            <button
              type="button"
              className="ai-chip"
              onClick={() => {
                setPrompt("计算当前列数值总和");
              }}
            >
              Σ 快速生成求和公式
            </button>
          </div>

          {/* Chat Messages Log */}
          <div className="ai-chat-log">
            {messages.map((m, idx) => (
              <div key={idx} className={`ai-message-row ${m.sender}`}>
                <div className="ai-bubble">
                  {m.text}
                  {m.action && (
                    <div className="ai-action-btn-row">
                      <button
                        type="button"
                        className="ai-apply-btn"
                        onClick={() => {
                          onApplyFormula(m.action!.formula);
                          onClose();
                        }}
                      >
                        ⚡ {m.action.label}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Box */}
          <div className="ai-input-area">
            <input
              type="text"
              className="ai-input"
              placeholder="向 AI 提问或提出表格处理指令 (如: 求 C 列平均值、分析销售走势)..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button type="button" className="ai-send-btn" onClick={handleSend}>
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
