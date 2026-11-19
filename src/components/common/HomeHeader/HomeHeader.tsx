import { useEffect, useId, useRef, useState } from 'react';
import wordmark from '../../../assets/images/brand/wordmark.svg';
import pin from '../../../assets/images/brand/pin.svg';
import pinHole from '../../../assets/images/brand/pin-hole.svg';
import profile from '../../../assets/icons/home/profile.svg';
import logout from '../../../assets/icons/home/logout.svg';
import './HomeHeader.scss';

interface HomeHeaderProps {
  onProfileClick?: () => void;
  onLogout?: () => void;
  profileImageUrl?: string | null;
}

function HomeHeader({ onProfileClick, onLogout, profileImageUrl }: HomeHeaderProps) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !profileRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);
  return (
    <header className="home-header">
      <div className="home-header__logo" role="img" aria-label="Meetdle">
        <img src={wordmark} alt="" draggable={false} />
        <img className="home-header__pin" src={pin} alt="" draggable={false} />
        <img className="home-header__pin-hole" src={pinHole} alt="" draggable={false} />
      </div>
      <div
        className="home-header__account"
        ref={profileRef}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setIsOpen(false);
        }}
      >
        <button
          ref={buttonRef}
          className="home-header__profile"
          type="button"
          aria-label="내 프로필"
          aria-expanded={isOpen}
          aria-controls={isOpen ? panelId : undefined}
          onClick={() => {
            setIsOpen((open) => !open);
            onProfileClick?.();
          }}
        >
          <img
            src={profileImageUrl && profileImageUrl !== failedImage ? profileImageUrl : profile}
            alt=""
            draggable={false}
            onError={() => {
              if (profileImageUrl) setFailedImage(profileImageUrl);
            }}
            style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: '50%' }}
          />
        </button>
        {isOpen && (
          <div className="home-header__account-panel" id={panelId}>
            <button
              className="home-header__logout"
              type="button"
              disabled={!onLogout}
              onClick={() => {
                setIsOpen(false);
                onLogout?.();
              }}
            >
              <img src={logout} alt="" draggable={false} />
              <span>로그아웃</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default HomeHeader;
