import './Header.scss';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBack?: () => void;
}

function Header({ title, showBackButton = false, onBack }: HeaderProps) {
  return (
    <header className="common-header">
      {showBackButton && (
        <button
          className="common-header__back"
          type="button"
          aria-label="뒤로가기"
          onClick={onBack}
          disabled={!onBack}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M15 5 8 12l7 7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      <h1 className="common-header__title">{title}</h1>
    </header>
  );
}

export default Header;
