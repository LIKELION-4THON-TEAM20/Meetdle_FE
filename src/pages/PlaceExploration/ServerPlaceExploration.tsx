import { sortPlaceCategories } from '../../features/places/categoryOrder';
import ExplorationSearchNotice from './components/ExplorationSearchNotice';
import RequestStatus from '../../components/common/RequestStatus/RequestStatus';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { getSession } from '../../api/auth';
import { api, ApiRequestError } from '../../api/client';
import type { Category, PlaceSearchResponse, RoomState, SessionResponse } from '../../api/types';
import clockIcon from '../../assets/place-exploration/clock.svg';
import searchIcon from '../../assets/place-exploration/search.svg';
import Button from '../../components/common/Button/Button';
import Modal from '../../components/common/Modal/Modal';
import Header from '../../components/common/Header/Header';
import { PATHS } from '../../router/paths';
import { serverScreenUrl } from '../../features/serverRoom/routing';
import ExplorationMap from './components/ExplorationMap';
import ExplorationPlaceCard from './components/ExplorationPlaceCard';
import {
  createApiExplorationRepository,
  categoryLabels,
  displayPlace,
  canCompleteRegistration,
  registeredCandidates,
  placeKey,
  registrationEditable,
  type ApiExplorationRepository,
} from './apiRepository';
import { formatRemaining, formatDistance } from './placeUtils';
import type { RecommendedPlace } from './types';
import './PlaceExploration.scss';

function errorMessage(error: unknown) {
  if (error instanceof ApiRequestError) {
    if (error.status === 401 || error.code === 'SESSION_CHANGED')
      return '로그인이 필요해요. 다시 로그인한 뒤 약속방을 열어주세요.';
    if (error.status === 403) return '이 약속방에 접근하거나 요청을 실행할 권한이 없어요.';
    if (error.status === 404 || error.status === 410) return '약속방을 찾을 수 없어요.';
    if (['INVALID_PICK', 'OUT_OF_RADIUS', 'CATEGORY_MISMATCH'].includes(error.code))
      return '등록할 수 없는 장소예요. 검색 결과를 새로 조회해주세요.';
    if (error.status === 409)
      return '등록 회차나 상태가 바뀌었어요. 최신 상태를 다시 조회해주세요.';
    if (error.status === 429) return '요청이 많아요. 잠시 후 다시 시도해주세요.';
    if (error.status === 503)
      return '서버에서 정보를 가져오지 못했어요. 잠시 후 다시 시도해주세요.';
    if (error.code === 'NETWORK_ERROR')
      return '서버에 연결하지 못했어요. 연결 상태를 확인해주세요.';
  }
  if (error instanceof TypeError) return '서버 설정 또는 응답을 확인할 수 없어요.';
  return error instanceof Error ? error.message : '요청에 실패했어요.';
}
function ErrorNotice({
  error,
  title = '장소 정보를 불러오지 못했어요.',
  onRetry,
  disabled,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
  disabled?: boolean;
}) {
  return (
    <RequestStatus
      title={title}
      description={errorMessage(error)}
      onRetry={onRetry}
      disabled={disabled}
    >
      {error instanceof ApiRequestError &&
        (error.status === 401 || error.code === 'SESSION_CHANGED') && (
          <Link to={PATHS.login}>로그인하기</Link>
        )}
    </RequestStatus>
  );
}

export default function ServerPlaceExploration({ roomId }: { roomId: string }) {
  const repository = useMemo(() => createApiExplorationRepository(roomId), [roomId]);
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<{ state: RoomState; receivedAt: number }>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [failedIntent, setFailedIntent] = useState(false);
  const [notice, setNotice] = useState('');
  const [clock, setClock] = useState(Date.now);
  const alive = useRef(false);
  const lock = useRef(false);
  const refreshing = useRef(false);
  const read = useRef<AbortController | null>(null);
  const operation = useRef<{ execute(): Promise<RoomState> } | null>(null);
  const completionIntent = useRef(false);
  const sessionObserved = useRef<SessionResponse | undefined>(undefined);
  const path = (target: string) => serverScreenUrl(target, roomId);
  const refresh = useCallback(
    async (initial = false) => {
      if (lock.current || refreshing.current) return;
      refreshing.current = true;
      read.current?.abort();
      const abort = new AbortController();
      read.current = abort;
      setLoading(true);
      setError(undefined);
      setNotice('');
      try {
        const state = await (initial
          ? repository.open(abort.signal)
          : repository.reload(abort.signal));
        const session = await getSession();
        if (!abort.signal.aborted && alive.current) {
          operation.current = null;
          completionIntent.current = false;
          setFailedIntent(false);
          sessionObserved.current = session;
          setSnapshot({ state, receivedAt: Date.now() });
        }
      } catch (cause) {
        if (!abort.signal.aborted && alive.current) setError(cause);
      } finally {
        if (read.current === abort) refreshing.current = false;
        if (!abort.signal.aborted && alive.current) setLoading(false);
      }
    },
    [repository],
  );
  useEffect(() => {
    alive.current = true;
    const unsubscribe = api.subscribeSession((session) => {
      const previous = sessionObserved.current;
      if (
        !previous ||
        (session &&
          session.user.userId === previous.user.userId &&
          session.csrfToken === previous.csrfToken)
      )
        return;
      sessionObserved.current = undefined;
      read.current?.abort();
      operation.current = null;
      setSnapshot(undefined);
      setLoading(false);
      setError(new ApiRequestError(null, { code: 'SESSION_CHANGED', message: 'Session changed' }));
    });
    refreshing.current = true;
    const initialRead = new AbortController();
    read.current = initialRead;
    void repository
      .open(initialRead.signal)
      .then(async (state) => {
        const session = await getSession();
        if (!initialRead.signal.aborted) {
          sessionObserved.current = session;
          setSnapshot({ state, receivedAt: Date.now() });
        }
      })
      .catch((cause: unknown) => {
        if (!initialRead.signal.aborted) setError(cause);
      })
      .finally(() => {
        if (read.current === initialRead) refreshing.current = false;
        if (!initialRead.signal.aborted) setLoading(false);
      });
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const focus = () => {
      if (!lock.current) void refresh(true);
    };
    window.addEventListener('focus', focus);
    return () => {
      alive.current = false;
      unsubscribe();
      sessionObserved.current = undefined;
      read.current?.abort();
      refreshing.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', focus);
    };
  }, [refresh, repository]);
  const state = snapshot?.state;
  const now = snapshot
    ? Date.parse(snapshot.state.serverNow) + Math.max(0, clock - snapshot.receivedAt)
    : clock;
  const run = async (make: () => { execute(): Promise<RoomState> }, complete = false) => {
    if (lock.current || loading) return;
    lock.current = true;
    read.current?.abort();
    setBusy(true);
    setError(undefined);
    setNotice('');
    try {
      if (!operation.current) {
        operation.current = make();
        completionIntent.current = complete;
      }
      const fresh = await operation.current.execute();
      if (!alive.current || !sessionObserved.current) return;
      setSnapshot({ state: fresh, receivedAt: Date.now() });
      setFailedIntent(false);
      operation.current = null;
      if (completionIntent.current) navigate(path(PATHS.registration));
      else setNotice('서버의 등록 현황을 확인했어요.');
      completionIntent.current = false;
    } catch (cause) {
      if (alive.current) {
        setError(cause);
        setFailedIntent(operation.current !== null);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const blocked = busy || loading || !!error || failedIntent;
  const registration = state?.registration;
  const candidates = state?.registration ? registeredCandidates(state) : [];
  const editable = !!state && registrationEditable(state, now) && !blocked;
  const status = () => navigate(path(PATHS.registration));
  return (
    <div className="page place-exploration">
      <Header title="장소 등록" showBackButton onBack={() => navigate(PATHS.home)} />
      <main className="place-exploration__content">
        {loading && !state && (
          <RequestStatus
            loading
            title="장소 등록 정보를 불러오는 중이에요."
            description="약속 정보와 내 등록 상태를 확인하고 있어요."
          />
        )}
        {!!error && (
          <ErrorNotice
            error={error}
            onRetry={!failedIntent ? () => void refresh(true) : undefined}
            disabled={busy || loading}
            title={
              failedIntent
                ? '장소 등록 요청을 처리하지 못했어요.'
                : '장소 등록 정보를 불러오지 못했어요.'
            }
          />
        )}
        {failedIntent && (
          <Button
            disabled={busy || loading}
            onClick={() =>
              void run(() => {
                throw new Error('요청을 확인할 수 없어요.');
              })
            }
          >
            서버 처리 결과 다시 확인
          </Button>
        )}
        {notice && <p role="status">{notice}</p>}
        {state && (
          <>
            {state.meeting && (
              <div className="place-exploration__heading">
                <div>
                  <h2>{state.meeting.station.name} 근처</h2>
                  <p>
                    {new Intl.DateTimeFormat('ko-KR', {
                      timeZone: 'Asia/Seoul',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hourCycle: 'h23',
                    }).format(new Date(state.meeting.meetingAt))}
                  </p>
                </div>
                {registration && (
                  <span className="place-exploration__timer">
                    <img src={clockIcon} alt="" />
                    마감까지 {formatRemaining(Date.parse(registration.closesAt), now)}
                  </span>
                )}
              </div>
            )}
            {!registration || !state.meeting ? (
              <p role="status">장소 등록 정보가 없어요. 현재 약속 상태를 확인해주세요.</p>
            ) : (
              <>
                <section className="exploration-summary" aria-label="내 등록 현황">
                  <div>
                    <h3>내 등록 {new Set(candidates.map(({ place }) => place.category)).size} / {registration.categories.length}</h3>
                    <p>
                      장소 {registration.uniqueCandidateCount}곳 ·{' '}
                      {registration.progress.completedCount} / {registration.progress.capacity}명
                      등록 완료
                    </p>
                  </div>
                  <ul>
                    {sortPlaceCategories(registration.categories).map((c) => (
                      <li
                        key={c.category}
                        className={
                          candidates.some(({ place }) => place.category === c.category)
                            ? 'exploration-summary__registered'
                            : ''
                        }
                      >
                        {categoryLabels[c.category]}
                      </li>
                    ))}
                  </ul>
                </section>
                {(registration.closedAt ||
                  state.phase !== 'PLACE_SUBMISSION_OPEN' ||
                  now >= Date.parse(registration.closesAt)) && (
                  <p role="status">장소 등록이 마감됐어요.</p>
                )}
                <>
                  <ServerSearch
                    registeredPlaces={(category) => {
                      const visible = candidates.filter(({ place }) => place.category === category);
                      return visible.length > 0 ? (
                        <section className="exploration-place-list" aria-label="내가 등록한 장소">
                          <h3>내가 등록한 장소</h3>
                          {visible.map(({ candidateId, place }) => (
                            <ExplorationPlaceCard
                              key={candidateId}
                              place={displayPlace(place)}
                              categoryLabel={categoryLabels[place.category]}
                              blocked={null}
                              pending={busy}
                              showRegister={false}
                              onRegister={() => {}}
                              removeDisabled={!editable || !state.allowedActions.includes('EDIT_NOMINATION')}
                              onRemove={() => void run(() => repository.withdraw(candidateId, now))}
                            />
                          ))}
                        </section>
                      ) : null;
                    }}
                    repository={repository}
                    state={state}
                    readVersion={snapshot!.receivedAt}
                    disabled={!editable || !state.allowedActions.includes('EDIT_NOMINATION')}
                    paused={busy || loading || failedIntent}
                    onRegister={(category, place) =>
                      void run(() => repository.nominate(category, place.id, now))
                    }
                  />
                </>
              </>
            )}
          </>
        )}
      </main>
      <footer className="place-exploration__footer">
        <Button
          className="place-exploration__complete"
          data-ready={!!state && canCompleteRegistration(state)}
          disabled={
            !editable ||
            !state?.allowedActions.includes('COMPLETE_COLLECTION') ||
            (!!state?.registration && !canCompleteRegistration(state))
          }
          onClick={() => {
            void run(() => repository.complete(now), true);
          }}
        >
          {busy ? '처리 중…' : registration?.myCompleted ? '등록 완료됨' : '등록 완료'}
        </Button>
        <Button className="place-exploration__status" variant="secondary" disabled={!state || busy} onClick={status}>
          등록 현황 보기
        </Button>
      </footer>
    </div>
  );
}

function ServerSearch({
  registeredPlaces,
  repository,
  state,
  readVersion,
  disabled,
  paused,
  onRegister,
}: {
  registeredPlaces: (category: Category) => ReactNode;
  repository: ApiExplorationRepository;
  state: RoomState;
  readVersion: number;
  disabled: boolean;
  paused: boolean;
  onRegister: (category: Category, place: RecommendedPlace) => void;
}) {
  const categories = sortPlaceCategories(state.registration!.categories);
  const [storedCategory, setCategory] = useState<Category>(categories[0]?.category ?? 'FOOD');
  const category = categories.some((c) => c.category === storedCategory)
    ? storedCategory
    : categories[0]?.category;
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [outsideRadius, setOutsideRadius] = useState<number | null>(null);
  const [nearby, setNearby] = useState<{
    category: Category;
    response: PlaceSearchResponse;
  } | null>(null);
  const [result, setResult] = useState<{
    key: string;
    contextKey: string;
    response?: PlaceSearchResponse;
    error?: unknown;
  }>();
  const [morePending, setMorePending] = useState(false);
  const moreLock = useRef(false);
  const moreAbort = useRef<AbortController | null>(null);
  const contextKey = JSON.stringify([
    state.roomId,
    state.registration!.round,
    state.meeting!.selectionId,
    category,
    query,
  ]);
  const key = JSON.stringify([
    state.revision,
    readVersion,
    state.registration!.round,
    state.meeting!.selectionId,
    category,
    query,
    attempt,
  ]);
  const current = result?.key === key ? result : undefined;
  const canSearch = !!category && state.allowedActions.includes('SEARCH_PLACES');
  const categoryAvailable = categories.find((c) => c.category === category)?.available === true;
  useEffect(() => {
    const abort = new AbortController();
    moreAbort.current?.abort();
    if (!canSearch || paused) return () => abort.abort();
    const timer = setTimeout(() => {
      void repository
        .search(category!, query, 1, abort.signal)
        .then((response) => {
          if (!abort.signal.aborted) {
            setResult({ key, contextKey, response });
            if (!query.trim()) setNearby({ category: category!, response });
          }
        })
        .catch((error: unknown) => {
          if (!abort.signal.aborted) setResult({ key, contextKey, error });
        });
    }, 250);
    return () => {
      abort.abort();
      clearTimeout(timer);
      moreAbort.current?.abort();
    };
  }, [repository, key, contextKey, category, query, canSearch, paused]);
  const response =
    current?.response ?? (result?.contextKey === contextKey ? result.response : undefined);
  const places = response?.items.map((item) => displayPlace(item.place, item)) ?? [];
  const radius =
    response?.radiusMeters ?? categories.find((c) => c.category === category)?.radiusMeters ?? 2500;
  const searchPlaces = query.trim()
    ? places.filter((p) => p.distanceMeters !== undefined && p.distanceMeters <= radius)
    : places;
  const outOfRangeSearch = !!query.trim() && !!response?.items.length && searchPlaces.length === 0;
  const nearbyResponse = nearby?.category === category ? nearby.response : undefined;
  const cultureUnavailable = category === 'CULTURE' && (
    !categoryAvailable || nearbyResponse?.available === false ||
    (nearbyResponse?.nextPage === null &&
      !nearbyResponse.items.some((item) => item.distanceMeters <= nearbyResponse.radiusMeters))
  );
  const nearbyItems = nearbyResponse?.items ?? [];
  const mapPlaces = query.trim()
    ? [
        ...nearbyItems.map((item) => displayPlace(item.place, item)),
        ...searchPlaces,
      ]
    : response ? places : nearbyItems.map((item) => displayPlace(item.place, item));
  const selected = [...places, ...nearbyItems.map((item) => displayPlace(item.place, item))].find(
    (p) => p.id === selectedId,
  );
  async function more() {
    if (!response?.nextPage || moreLock.current || paused) return;
    moreLock.current = true;
    setMorePending(true);
    const abort = new AbortController();
    moreAbort.current = abort;
    try {
      const next = await repository.search(category!, query, response.nextPage, abort.signal);
      if (!abort.signal.aborted) {
        const combined = new Map(
          [...response.items, ...next.items].map((item) => [placeKey(item.place), item]),
        );
        setResult({ key, contextKey, response: { ...next, items: [...combined.values()] } });
      }
    } catch (error) {
      if (!abort.signal.aborted) setResult({ key, contextKey, response, error });
    } finally {
      moreLock.current = false;
      setMorePending(false);
    }
  }
  const card = (place: RecommendedPlace) => {
    const registered = registeredCandidates(state).some(({ place: p }) => placeKey(p) === place.id);
    const blocked =
      !place.eligible || !response?.available || !categoryAvailable
        ? '서버에서 등록할 수 없는 장소로 판정했어요.'
        : disabled || paused || !current || !!current.error
          ? '현재는 등록 내용을 변경할 수 없어요.'
          : null;
    return (
      <ExplorationPlaceCard
        key={place.id}
        place={place}
        categoryLabel={categoryLabels[category!]}
        selected={selectedId === place.id}
        registered={registered}
        pending={false}
        blocked={blocked}
        onSelect={() => setSelectedId(place.id)}
        onRegister={() => onRegister(category!, place)}
      />
    );
  };
  const map = state.meeting && category && (
    <ExplorationMap
      area={{
        center: { latitude: state.meeting.station.lat, longitude: state.meeting.station.lng },
        radiusMeters:
          response?.radiusMeters ?? categories.find((c) => c.category === category)!.radiusMeters,
      }}
      places={[
        ...new Map(
          [
            ...registeredCandidates(state)
              .filter(({ place }) => place.category === category)
              .map(({ place }) => displayPlace(place)),
            ...mapPlaces,
          ].map((place) => [place.id, place]),
        ).values(),
      ]}
      registeredIds={registeredCandidates(state).map(({ place }) => placeKey(place))}
      selectedId={selectedId}
      onSelect={(id) => {
        const item =
          response?.items.find((item) => placeKey(item.place) === id) ??
          nearbyItems.find((item) => placeKey(item.place) === id);
        const radius =
          response?.radiusMeters ?? categories.find((c) => c.category === category)!.radiusMeters;
        if (item && item.distanceMeters > radius) {
          setOutsideRadius(radius);
          return;
        }
        setSelectedId(id);
      }}
    />
  );
  return (
    <>
      <div className="place-exploration__categories" aria-label="장소 카테고리">
        {categories.map((c) => (
          <button
            key={c.category}
            type="button"
            disabled={paused}
            aria-pressed={category === c.category}
            onClick={() => {
              setCategory(c.category);
              setSelectedId(null);
              setQuery('');
            }}
          >
            {categoryLabels[c.category]}
          </button>
        ))}
      </div>
      <label className="place-exploration__search">
        <img src={searchIcon} alt="" />
        <input
          aria-label="장소 검색"
          placeholder="장소 검색"
          maxLength={60}
          disabled={!canSearch || paused}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedId(null);
          }}
        />
      </label>
      {cultureUnavailable && (
        <ExplorationSearchNotice warning message="이 지역에는 등록할 수 있는 문화시설이 없어요." />
      )}
      {!cultureUnavailable && outOfRangeSearch && (
        <ExplorationSearchNotice message="선택 가능한 범위를 벗어난 장소예요." />
      )}
      {!query.trim() && !selected && !cultureUnavailable && (
        <div className="place-exploration__hint">
          <h3>장소를 검색하거나 지도에서 찾아보세요</h3>
          <p>지도에서 핀을 누르면 아래에 장소 정보가 표시돼요.<br />한 번에 1곳만 보여줘요.</p>
        </div>
      )}
      {cultureUnavailable ? null : !canSearch ? (
        <ExplorationSearchNotice message="현재 방 상태에서는 장소를 검색할 수 없어요." />
      ) : (
        <>
          {!current && !paused && !response && (
            <ExplorationSearchNotice message="장소를 검색하는 중이에요." />
          )}
          {current?.error && (
            <ExplorationSearchNotice
              message="장소를 검색하지 못했어요. 잠시 후 다시 시도해주세요."
              disabled={paused}
              onRetry={() => {
                if (current.response) void more();
                else setAttempt((n) => n + 1);
              }}
            />
          )}
          {response && (
            <>
              {(!response.available || !categoryAvailable) && !outOfRangeSearch && places.length > 0 && (
                <ExplorationSearchNotice message="이 카테고리는 현재 등록할 수 없어요." />
              )}
              {!places.length && !current?.error && (
                <ExplorationSearchNotice message={query.trim() ? '검색 결과가 없어요.' : '주변에 검색된 장소가 없어요.'} />
              )}
              {query.trim() ? (
                !outOfRangeSearch && searchPlaces.length > 0 && (
                  <section className="exploration-place-list" aria-label="장소 검색 결과">
                    <h3>검색 결과</h3>
                    {searchPlaces.map(card)}
                  </section>
                )
              ) : null}
              {!!query.trim() && !!response.nextPage && (
                <Button className="place-exploration__more" variant="secondary" disabled={morePending || paused || !current} onClick={() => void more()}>
                  {morePending ? '불러오는 중…' : '검색 결과 더 보기'}
                </Button>
              )}
            </>
          )}
        </>
      )}
      {map}
      {!query.trim() && selected && !cultureUnavailable && (
        <section className="exploration-place-list" aria-label="선택한 장소">
          <h3>선택한 장소</h3>
          {card(selected)}
        </section>
      )}
      {category && registeredPlaces(category)}
      <Modal
        open={outsideRadius !== null}
        onClose={() => setOutsideRadius(null)}
        className="exploration-notice-modal"
        aria-labelledby="outside-radius-title"
      >
        <h2 id="outside-radius-title">반경 밖의 장소는 선택할 수 없어요</h2>
        <p>역으로부터 반경 {formatDistance(outsideRadius ?? 0)} 이내 장소만 선택 가능해요</p>
        <Button onClick={() => setOutsideRadius(null)}>다시 선택하러 가기</Button>
      </Modal>
    </>
  );
}
