import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import Header from '../../components/common/Header/Header';
import Button from '../../components/common/Button/Button';
import clock from '../../assets/place-exploration/clock.svg';
import searchIcon from '../../assets/place-exploration/search.svg';
import ExplorationNoticeModal from './components/ExplorationNoticeModal';
import ExplorationMap from './components/ExplorationMap';
import ExplorationPlaceCard from './components/ExplorationPlaceCard';
import { createMockExplorationRepository, mockExplorationRepository } from './mockRepository';
import {
  formatDistance,
  formatRemaining,
  missingRequiredCategories,
  registrationBlock,
  statusPreview,
} from './placeUtils';
import type {
  CategoryId,
  ExplorationRepository,
  ExplorationSnapshot,
  RecommendedPlace,
} from './types';
import './PlaceExploration.scss';

function ExplorationScreen({
  repository,
  onBack,
  onViewStatus,
}: {
  repository: ExplorationRepository;
  onBack: () => void;
  onViewStatus?: () => void;
}) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<ExplorationSnapshot | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [category, setCategory] = useState<CategoryId>('restaurant');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState<'outside' | 'required' | null>(null);
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

  async function registerPlace(place: RecommendedPlace, submittedAt: number) {
    if (!snapshot || submitting.current) return;
    const blocked = registrationBlock(snapshot, place, submittedAt);
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
        { roomId: snapshot.roomId, placeId: place.id },
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
    const place = snapshot?.recommendations.find((item) => item.id === id);
    if (place && !place.eligible) {
      setModal('outside');
      return;
    }
    setSelectedId(id);
    setRegisterError('');
    setNotice('');
  };
  const mine =
    snapshot?.registrations.filter((entry) => entry.userId === snapshot.currentUserId) ?? [];

  const missing = snapshot ? missingRequiredCategories(snapshot) : [];
  const registrationClosed = !snapshot || !snapshot.registrationOpen || now >= snapshot.deadline;
  const canComplete = !!snapshot && missing.length === 0 && !registrationClosed;
  const viewStatus = (data: ExplorationSnapshot) => {
    if (onViewStatus) onViewStatus();
    else
      navigate('/rooms/registration/status?scenario=exploration', {
        state: statusPreview(data),
      });
  };
  const changeCategory = (id: CategoryId) => {
    setCategory(id);
    setSelectedId(null);
    setQuery('');
    setRegisterError('');
    setNotice('');
  };
  const complete = async () => {
    if (!snapshot || submitting.current || registrationClosed) return;
    if (missing.length) {
      setModal('required');
      return;
    }
    submitting.current = true;
    setPending(true);
    setRegisterError('');
    const controller = new AbortController();
    registrationRequest.current = controller;
    try {
      const response = await repository.complete(snapshot.roomId, controller.signal);
      if (controller.signal.aborted) return;
      setSnapshot(response);
      viewStatus(response);
    } catch (cause) {
      if (!controller.signal.aborted)
        setRegisterError(
          cause instanceof Error
            ? cause.message
            : '등록 완료 처리에 실패했어요. 다시 시도해주세요.',
        );
    } finally {
      submitting.current = false;
      if (!controller.signal.aborted) setPending(false);
    }
  };

  return (
    <div className="page place-exploration">
      <Header title="장소 등록" showBackButton onBack={onBack} />
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
                  return (
                    <li
                      className={entry ? 'exploration-summary__registered' : ''}
                      key={item.id}
                      aria-label={`${item.label} ${entry ? '등록됨' : '미등록'}`}
                    >
                      {item.label}
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
                  onClick={() => changeCategory(item.id)}
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
                }}
              />
            </label>
            {query.trim() ? (
              <section className="exploration-place-list" aria-label="장소 검색 결과">
                <h3>검색 결과</h3>
                {places.filter((place) => place.eligible).length ? (
                  places
                    .filter((place) => place.eligible)
                    .map((place) => (
                      <ExplorationPlaceCard
                        key={place.id}
                        place={place}
                        selected={selectedId === place.id}
                        categoryLabel={
                          snapshot.categories.find((item) => item.id === place.categoryId)?.label ??
                          ''
                        }
                        blocked={registrationBlock(snapshot, place, now)}
                        registered={mine.some((entry) => entry.placeId === place.id)}
                        pending={pending}
                        onRegister={(submittedAt) => void registerPlace(place, submittedAt)}
                      />
                    ))
                ) : (
                  <p className="exploration-place-list__empty">검색 결과가 없어요.</p>
                )}
              </section>
            ) : (
              <div className="place-exploration__hint">
                <h3>장소를 검색하거나 지도에서 찾아보세요</h3>
                <p>
                  지도에서 핀을 누르면 지도 아래에 장소 정보가 표시돼요.
                  <br />한 번에 1곳만 보여줘요.
                </p>
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
              registeredIds={mine.map((entry) => entry.placeId)}
              onSelect={select}
            />
            {!query.trim() && selected && (
              <section
                className="exploration-place-list exploration-place-list--selected"
                aria-label="선택한 장소"
              >
                <h3>선택한 장소</h3>
                <ExplorationPlaceCard
                  place={selected}
                  selected
                  categoryLabel={
                    snapshot.categories.find((item) => item.id === selected.categoryId)?.label ?? ''
                  }
                  blocked={registrationBlock(snapshot, selected, now)}
                  registered={mine.some((entry) => entry.placeId === selected.id)}
                  pending={pending}
                  onRegister={(submittedAt) => void registerPlace(selected, submittedAt)}
                />
              </section>
            )}
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
          className="place-exploration__complete"
          disabled={registrationClosed || pending}
          data-ready={canComplete}
          aria-busy={pending}
          onClick={() => void complete()}
        >
          {pending ? '처리 중…' : '등록 완료'}
        </Button>
        {!canComplete && (
          <Button
            className="place-exploration__status"
            disabled={!snapshot || pending}
            onClick={() => {
              if (snapshot) viewStatus(snapshot);
            }}
          >
            등록 현황 보기
          </Button>
        )}
      </footer>
      {snapshot && modal && (
        <ExplorationNoticeModal
          title={
            modal === 'outside'
              ? '반경 밖의 장소는 선택할 수 없어요'
              : '필수 카테고리의 장소를 선택해주세요'
          }
          description={
            modal === 'outside'
              ? `역으로부터 반경 ${formatDistance(snapshot.area.radiusMeters)} 이내 장소만 선택 가능해요`
              : `${missing.map((item) => item.label).join('·')} 카테고리에 등록된 장소가 없으면 완료할 수 없어요`
          }
          actionLabel={
            modal === 'outside' ? '다시 선택하러 가기' : '필수 카테고리 장소 등록하러 가기'
          }
          onClose={() => setModal(null)}
          onAction={() => {
            if (modal === 'required' && missing[0]) changeCategory(missing[0].id);
            setModal(null);
          }}
        />
      )}
    </div>
  );
}

function PlaceExploration({
  repository,
  onBack,
  onViewStatus,
}: {
  repository?: ExplorationRepository;
  onBack?: () => void;
  onViewStatus?: () => void;
}) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const scenario = import.meta.env.DEV ? params.get('scenario') : null;
  const fixtureRepository = useMemo(
    () =>
      scenario ? createMockExplorationRepository(undefined, scenario) : mockExplorationRepository,
    [scenario],
  );
  return (
    <ExplorationScreen
      key={scenario ?? 'default'}
      repository={repository ?? fixtureRepository}
      onViewStatus={onViewStatus}
      onBack={onBack ?? (() => navigate('/rooms/registration/setup'))}
    />
  );
}

export default PlaceExploration;
