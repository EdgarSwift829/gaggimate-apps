interface Props {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

export default function StarRating({ value, onChange, readonly }: Props) {
  return (
    <span style={{ fontSize: "1.5rem", cursor: readonly ? "default" : "pointer" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span
          key={star}
          onClick={() => !readonly && onChange?.(star)}
          style={{ color: star <= value ? "#f59e0b" : "#555" }}
        >
          ★
        </span>
      ))}
    </span>
  );
}
