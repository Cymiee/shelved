interface Props {
  size?: number;
}

/** Loading indicator: three spines taking turns hopping off the shelf. */
export default function Spinner({ size = 36 }: Props) {
  return (
    <span className="spine-loader" role="status" aria-label="Loading" style={{ width: size, height: size }}>
      <span />
      <span />
      <span />
    </span>
  );
}

/** Full-viewport-height centered spinner — use as a page loading state. */
export function PageSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
      }}
    >
      <Spinner size={40} />
    </div>
  );
}
