interface AdditionalNotesProps {
  value: string;
  onChange: (value: string) => void;
}

export function AdditionalNotes({ value, onChange }: AdditionalNotesProps) {
  return (
    <section
      className="v2-card v2-workspace-card"
      aria-labelledby="additional-notes-title"
    >
      <div className="v2-workspace-heading">
        <div>
          <span className="v2-eyebrow">Additional notes</span>
          <h2 id="additional-notes-title">其他備註</h2>
        </div>
      </div>
      <textarea
        aria-label="其他備註 Additional notes"
        placeholder="Impression、plan、pending labs、家屬溝通…"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}
