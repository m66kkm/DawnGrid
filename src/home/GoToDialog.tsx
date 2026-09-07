import { useState } from "react";

interface GoToDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGoTo: (address: string) => void;
}

export function GoToDialog({ isOpen, onClose, onGoTo }: GoToDialogProps) {
  const [target, setTarget] = useState("A1");

  if (!isOpen) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (target.trim()) {
      onGoTo(target.trim().toUpperCase());
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-window goto-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>定位 (Go To)</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-body">
          <label className="dialog-field">
            <span>引用位置 (例如: A1, C10, E50):</span>
            <input
              type="text"
              className="dialog-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              autoFocus
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="dialog-btn secondary" onClick={onClose}>
              取消
            </button>
            <button type="submit" className="dialog-btn primary">
              定位跳转
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
