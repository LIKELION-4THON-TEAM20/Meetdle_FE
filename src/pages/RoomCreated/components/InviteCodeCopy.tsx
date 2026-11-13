import './InviteCodeCopy.scss';

interface InviteCodeCopyProps {
  code: string;
}

function InviteCodeCopy({ code }: InviteCodeCopyProps) {
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      window.alert('초대 코드를 복사했어요.');
    } catch {
      window.alert('초대 코드를 복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.');
    }
  };

  return (
    <section className="invite-code-copy" aria-label="초대 코드">
      <span className="invite-code-copy__label">초대 코드</span>
      <span className="invite-code-copy__code">{code}</span>
      <button
        className="invite-code-copy__button"
        type="button"
        onClick={copyCode}
        aria-label="초대 코드 복사"
      >
        복사
      </button>
    </section>
  );
}

export default InviteCodeCopy;
