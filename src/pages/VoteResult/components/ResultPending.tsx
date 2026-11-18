export default function ResultPending({ waitingForHost = false }: { waitingForHost?: boolean }) {
  return (
    <section className="result-pending" role="status">
      <h2>{waitingForHost ? '방장이 결과를 확정하는 중이에요.' : '결과를 정리하고 있어요.'}</h2>
      <p>방장이 결과를 확정하면 확인할 수 있어요.</p>
    </section>
  );
}
