import wordmark from '../../../assets/images/brand/wordmark.svg';
import pin from '../../../assets/images/brand/pin.svg';
import pinHole from '../../../assets/images/brand/pin-hole.svg';
import profile from '../../../assets/icons/home/profile.svg';
import './HomeHeader.scss';

interface HomeHeaderProps {
  onProfileClick?: () => void;
}

function HomeHeader({ onProfileClick }: HomeHeaderProps) {
  return (
    <header className="home-header">
      <div className="home-header__logo" role="img" aria-label="Meetdle">
        <img src={wordmark} alt="" draggable={false} />
        <img className="home-header__pin" src={pin} alt="" draggable={false} />
        <img className="home-header__pin-hole" src={pinHole} alt="" draggable={false} />
      </div>
      <button
        className="home-header__profile"
        type="button"
        aria-label="내 프로필"
        aria-disabled={!onProfileClick}
        onClick={onProfileClick}
      >
        <img src={profile} alt="" draggable={false} />
      </button>
    </header>
  );
}

export default HomeHeader;
