import { Icon } from "./icons";
import { DEFAULT_PRACTICE_DURATION_OPTIONS, FOCUS_TAGS } from "./lib/models";
import type { PracticeTask } from "./lib/models";

export type PracticeTaskEditDraft = {
  title: string;
  keyPoints: string;
  focusTags: string[];
  customFocus: string;
  isHighPriority: boolean;
  durationValue: number;
};

type PracticeTaskEditFormProps = {
  task: PracticeTask;
  draft: PracticeTaskEditDraft;
  pending: string;
  onCancel: () => void;
  onChange: (patch: Partial<PracticeTaskEditDraft>) => void;
  onToggleFocus: (focus: string) => void;
  onSave: () => void;
};

export function PracticeTaskEditForm({ task, draft, pending, onCancel, onChange, onToggleFocus, onSave }: PracticeTaskEditFormProps) {
  const customTags = draft.focusTags.filter(tag => !FOCUS_TAGS.includes(tag as typeof FOCUS_TAGS[number]));
  return <div className="practice-edit-form real-form">
    <div className="task-editor-head">
      <strong>编辑练习任务</strong>
      <button type="button" disabled={Boolean(pending)} onClick={onCancel}>取消</button>
    </div>
    <label><span>任务标题 *</span><input value={draft.title} onChange={event => onChange({ title:event.target.value })} /></label>
    <label><span>任务要点 <small>选填</small></span><textarea rows={2} value={draft.keyPoints} onChange={event => onChange({ keyPoints:event.target.value })} /></label>
    <fieldset>
      <legend>Focus *</legend>
      <div className="tag-picker compact edit-focus-picker">
        {FOCUS_TAGS.map(focus => <button type="button" className={draft.focusTags.includes(focus) ? "selected" : ""} key={focus} onClick={() => onToggleFocus(focus)}>{focus}</button>)}
      </div>
      {customTags.length > 0 && <div className="tag-picker compact custom-focus-review">
        {customTags.map(tag => <button type="button" className="selected" key={tag} onClick={() => onToggleFocus(tag)}>{tag}</button>)}
      </div>}
    </fieldset>
    <label><span>自定义 Focus</span><input placeholder="添加自定义标签" value={draft.customFocus} onChange={event => onChange({ customFocus:event.target.value })} /></label>
    <div className="duration-editor no-border">
      <span>练习时长</span>
      <div className="quick-duration task-duration-picks">
        {DEFAULT_PRACTICE_DURATION_OPTIONS.map(value => <button type="button" className={draft.durationValue === value ? "selected" : ""} key={value} onClick={() => onChange({ durationValue:value })}>{value} 分钟</button>)}
      </div>
      <label><span>自定义分钟数</span><input type="number" min="1" value={draft.durationValue} onChange={event => onChange({ durationValue:Math.max(1, Number(event.target.value)) })} /></label>
    </div>
    <label className="switch-row">
      <input type="checkbox" checked={draft.isHighPriority} onChange={event => onChange({ isHighPriority:event.target.checked })} />
      <span><strong>高优先级</strong><small>让这个任务更靠前显示</small></span>
    </label>
    <button type="button" className="primary-button enabled" disabled={Boolean(pending)} onClick={onSave}>
      {pending === `edit:${task.id}` ? "保存中…" : "保存修改"} <Icon name="arrow" />
    </button>
  </div>;
}
