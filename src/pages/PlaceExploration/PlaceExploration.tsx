import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import clock from '../../assets/place-exploration/clock.svg';
import searchIcon from '../../assets/place-exploration/search.svg';
import ExplorationMap from './components/ExplorationMap';
import ExplorationPlaceCard from './components/ExplorationPlaceCard';
import PlaceDetailLink from './components/PlaceDetailLink';
import { createMockExplorationRepository, mockExplorationRepository } from './mockRepository';
import { formatDistance, formatRemaining, registrationBlock, statusPreview } from './placeUtils';
import type { CategoryId, ExplorationRepository, ExplorationSnapshot } from './types';
import './PlaceExploration.scss';

function ExplorationScreen({ repository }: { repository: ExplorationRepository }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<ExplorationSnapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [category, setCategory] = useState<CategoryId>('restaurant');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openedPlaceId, setOpenedPlaceId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now);
  const submitting = useRef(false);
  const registrationRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    repository
      .load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setSnapshot(data);
          setCategory(data.categories[0]?.id ?? 'restaurant');
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(cause instanceof Error ? cause.message : '추천 정보를 불러오지 못했어요.');
      });
    return () => controller.abort();
  }, [repository, loadAttempt]);
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      registrationRequest.current?.abort();
    };
  }, []);
  const places = useMemo(
    () =>
      snapshot?.recommendations.filter(
        (place) =>
          place.categoryId === category &&
          `${place.name} ${place.address}`.toLowerCase().includes(query.trim().toLowerCase()),
      ) ?? [],
    [snapshot, category, query],
  );
  const selected = snapshot?.recommendations.find((place) => place.id === selectedId);

  async function registerSelected(submittedAt: number) {
    if (!snapshot || !selected || submitting.current) return;
    const blocked = registrationBlock(snapshot, selected, submittedAt);
    if (blocked) {
      setRegisterError(blocked);
      return;
    }
    submitting.current = true;
    setPending(true);
    setRegisterError('');
    const controller = new AbortController();
    registrationRequest.current = controller;
    try {
      const response = await repository.register(
        { roomId: snapshot.roomId, placeId: selected.id },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setSnapshot(response);
      setNotice(
        response.source === 'mock'
          ? '목 데이터의 등록 현황에 반영했어요. 서버에는 저장되지 않아요.'
          : '등록 현황에 반영됐어요.',
      );
    } catch (cause) {
      if (!controller.signal.aborted)
        setRegisterError(
          cause instanceof Error ? cause.message : '등록하지 못했어요. 다시 시도해주세요.',
        );
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  }
  const select = (id: string) => {
    setSelectedId(id);
    setOpenedPlaceId(null);
    setRegisterError('');
    setNotice('');
  };
  const mine =
    snapshot?.registrations.filter((entry) => entry.userId === snapshot.currentUserId) ?? [];

  return (
    <div className="page place-exploration">
      <Header title="장소 등록" showBackButton onBack={() => navigate(-1)} />
      <main className="place-exploration__content">
        {!snapshot ? (
          <div className="place-exploration__state" role="status">
            {loadError ? (
              <>
                <p>{loadError}</p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setLoadError('');
                    setLoadAttempt((value) => value + 1);
                  }}
                >
                  추천 정보 다시 시도
                </Button>
              </>
            ) : (
              <p>추천 장소를 불러오는 중이에요.</p>
            )}
          </div>
        ) : (
          <>
            <div className="place-exploration__heading">
              <div>
                <h2>{snapshot.areaLabel}</h2>
                <p>
                  {new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    month: 'long',
                    day: 'numeric',
                  }).format(snapshot.meetingAt)}{' '}
                  ·{' '}
                  {new Intl.DateTimeFormat('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    hour: '2-digit',
                    minute: '2-digit',
                    hourCycle: 'h23',
                  }).format(snapshot.meetingAt)}
                </p>
              </div>
              <span className="place-exploration__timer">
                <img src={clock} alt="" />
                마감까지 {formatRemaining(snapshot.deadline, now)}
              </span>
            </div>
            <section className="exploration-summary" aria-label="내 등록 현황">
              <div>
                <h3>
                  내 등록 {mine.length} / {snapshot.categories.length}
                </h3>
                <p>
                  장소 {snapshot.registeredPlaceCount}곳 ·{' '}
                  {snapshot.participants.filter((entry) => entry.status === 'completed').length} /{' '}
                  {snapshot.participants.length}명 등록 완료
                </p>
              </div>
              <ul>
                {snapshot.categories.map((item) => {
                  const entry = mine.find((registration) => registration.categoryId === item.id);
                  const place = snapshot.recommendations.find(
                    (candidate) => candidate.id === entry?.placeId,
                  );
                  return (
                    <li className={entry ? 'exploration-summary__registered' : ''} key={item.id}>
                      {item.label} · {entry ? (place?.name ?? '등록됨') : '미등록'}
                    </li>
                  );
                })}
              </ul>
            </section>
            <div className="place-exploration__categories" aria-label="추천 장소 카테고리">
              {snapshot.categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={category === item.id}
                  onClick={() => {
                    setCategory(item.id);
                    setSelectedId(null);
                    setOpenedPlaceId(null);
                    setQuery('');
                    setRegisterError('');
                    setNotice('');
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="place-exploration__search">
              <img src={searchIcon} alt="" />
              <input
                type="text"
                aria-label="추천 장소 검색"
                placeholder="장소 검색"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedId(null);
                  setOpenedPlaceId(null);
                }}
              />
            </label>
            {query.trim() && (
              <div className="exploration-results" aria-label="장소 검색 결과">
                {places.length ? (
                  places.map((place) => (
                    <button
                      key={place.id}
                      type="button"
                      aria-pressed={place.id === selectedId}
                      onClick={() => select(place.id)}
                    >
                      {place.name}
                      <span>
                        {snapshot.categories.find((item) => item.id === place.categoryId)?.label} ·{' '}
                        {formatDistance(place.distanceMeters)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p>검색 결과가 없어요.</p>
                )}
              </div>
            )}
            {selected ? (
              <ExplorationPlaceCard
                place={selected}
                categoryLabel={
                  snapshot.categories.find((item) => item.id === selected.categoryId)?.label ?? ''
                }
                blocked={registrationBlock(snapshot, selected, now)}
                pending={pending}
                onRegister={(submittedAt) => void registerSelected(submittedAt)}
              />
            ) : (
              <div className="place-exploration__hint">
                <h3>장소를 검색하거나 지도에서 찾아보세요</h3>
                <p>지도에서 핀을 누르면 이 자리에 장소 정보가 표시돼요. 한 번에 1곳만 보여줘요.</p>
              </div>
            )}
            {registerError && (
              <p className="place-exploration__error" role="alert">
                {registerError} 선택한 장소는 유지됩니다.
              </p>
            )}
            {notice && (
              <p className="place-exploration__notice" role="status">
                {notice}
              </p>
            )}
            {snapshot.area.expansionMessage && (
              <p className="place-exploration__notice">{snapshot.area.expansionMessage}</p>
            )}
            <ExplorationMap
              area={snapshot.area}
              places={places}
              selectedId={selectedId}
              onSelect={select}
            />
            <section className="exploration-recommendations" aria-label="추천 장소 목록">
              <h3>추천 장소</h3>
              {places.length ? (
                <ul>
                  {places.map((place) => (
                    <li
                      key={place.id}
                      className={
                        place.id === (openedPlaceId ?? selectedId)
                          ? 'exploration-recommendations__selected'
                          : ''
                      }
                    >
                      <PlaceDetailLink
                        place={place}
                        className="exploration-recommendations__link"
                        onActivate={() => setOpenedPlaceId(place.id)}
                      >
                        <span className="exploration-recommendations__name">{place.name}</span>
                        <span className="exploration-recommendations__meta">
                          {snapshot.categories.find((item) => item.id === place.categoryId)?.label}{' '}
                          · {formatDistance(place.distanceMeters)}
                        </span>
                      </PlaceDetailLink>
                    </li>
                  ))}
                </ul>
              ) : (
                <p role="status">
                  {query.trim()
                    ? '검색 결과가 없어요.'
                    : category === 'culture'
                      ? '이 지역에는 등록할 수 있는 문화시설이 없어요.'
                      : '추천 장소가 없어요.'}
                </p>
              )}
            </section>
            {snapshot.source === 'mock' && (
              <p className="place-exploration__mock">
                목 데이터 미리보기예요. 실제 추천·등록 API는 연결되지 않았어요.
              </p>
            )}
          </>
        )}
      </main>
      <footer className="place-exploration__footer">
        <Button
          variant="secondary"
          disabled={!snapshot}
          onClick={() => {
            if (snapshot)
              navigate('/rooms/registration/status?scenario=exploration', {
                state: statusPreview(snapshot),
              });
          }}
        >
          등록 현황 보기
        </Button>
      </footer>
    </div>
  );
}

function PlaceExploration({ repository }: { repository?: ExplorationRepository }) {
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  const fixtureRepository = useMemo(
    () =>
      scenario ? createMockExplorationRepository(undefined, scenario) : mockExplorationRepository,
    [scenario],
  );
  return (
    <ExplorationScreen key={scenario ?? 'default'} repository={repository ?? fixtureRepository} />
  );
}

export default PlaceExploration;
