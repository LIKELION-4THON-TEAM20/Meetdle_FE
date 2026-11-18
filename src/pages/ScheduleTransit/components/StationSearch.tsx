import { useRef } from 'react';
import searchIcon from '../../../assets/icons/schedule-transit/search.svg';
import checkIcon from '../../../assets/icons/schedule-transit/check.svg';
import {
  changeStationQuery,
  isSupportedStation,
  normalizeStationQuery,
  searchStations,
} from '../scheduleUtils';
import type { Station, StationSearchValue } from '../types';

interface StationSearchProps {
  kind: 'departure' | 'destination';
  stations: readonly Station[];
  value: StationSearchValue;
  onChange: (value: StationSearchValue) => void;
  results?: readonly Station[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}

function StationSearch({
  kind,
  stations,
  value,
  onChange,
  results: serverResults,
  loading = false,
  error,
  onRetry,
}: StationSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLUListElement>(null);
  const isDestination = kind === 'destination';
  const results = serverResults ?? searchStations(stations, value.query);
  const hasQuery = value.query.trim().length > 0;
  const hasUnsupported = results.some((station) => !isSupportedStation(station));
  const onlyUnsupported =
    results.length > 0 && results.every((station) => !isSupportedStation(station));
  const helperId = `${kind}-help`;

  return (
    <section className="station-search" aria-labelledby={`${kind}-title`}>
      <h3 id={`${kind}-title`}>
        {isDestination ? '약속이 끝나고 어디로 가나요?' : '어디에서 출발하나요?'}
      </h3>
      {isDestination && (
        <label className="station-search__label" htmlFor={`${kind}-query`}>
          이후 목적지
        </label>
      )}
      <div
        className={`station-search__input-wrap${onlyUnsupported ? ' station-search__input-wrap--unsupported' : ''}`}
      >
        <img src={searchIcon} alt="" draggable={false} />
        <input
          ref={inputRef}
          id={`${kind}-query`}
          type="text"
          aria-label={isDestination ? '이후 목적지 검색' : '출발역 검색'}
          aria-describedby={helperId}
          aria-controls={hasQuery ? `${kind}-results` : undefined}
          placeholder={isDestination ? '이후 목적지 검색' : '지하철역 검색'}
          value={value.query}
          autoComplete="off"
          maxLength={40}
          aria-busy={loading}
          onChange={(event) => onChange(changeStationQuery(value, event.target.value))}
          onKeyDown={(event) => {
            if (event.key !== 'ArrowDown') return;
            const first =
              resultsRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)');
            if (first) {
              event.preventDefault();
              first.focus();
            }
          }}
        />
      </div>
      {hasQuery && (
        <ul
          className="station-search__results"
          id={`${kind}-results`}
          ref={resultsRef}
          aria-label={isDestination ? '이후 목적지 검색 결과' : '출발역 검색 결과'}
        >
          {loading ? (
            <li className="station-search__empty" role="status">
              역을 검색하고 있어요.
            </li>
          ) : error ? (
            <li className="station-search__empty" role="alert">
              {error}
              {onRetry && (
                <button type="button" onClick={onRetry}>
                  검색 다시 시도
                </button>
              )}
            </li>
          ) : results.length ? (
            results.map((station) => {
              const supported = isSupportedStation(station);
              const selected = value.station?.id === station.id;
              return (
                <li key={station.id}>
                  <button
                    type="button"
                    disabled={!supported}
                    aria-pressed={selected}
                    onClick={() => {
                      if (supported)
                        onChange({ query: normalizeStationQuery(station.name), station });
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') {
                        event.preventDefault();
                        inputRef.current?.focus();
                        return;
                      }
                      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
                      event.preventDefault();
                      const buttons = Array.from(
                        resultsRef.current?.querySelectorAll<HTMLButtonElement>(
                          'button:not(:disabled)',
                        ) ?? [],
                      );
                      const next =
                        buttons.indexOf(event.currentTarget) + (event.key === 'ArrowDown' ? 1 : -1);
                      if (next < 0) inputRef.current?.focus();
                      else buttons[Math.min(next, buttons.length - 1)]?.focus();
                    }}
                  >
                    <span className="station-search__station">
                      <span>{station.name}</span>
                      <span className="station-search__lines">
                        {station.lines.map((line) => line.name).join(' · ')}
                      </span>
                    </span>
                    {selected && <img src={checkIcon} alt="" draggable={false} />}
                  </button>
                </li>
              );
            })
          ) : (
            <li className="station-search__empty">검색 결과가 없어요.</li>
          )}
        </ul>
      )}
      <div className="station-search__help" id={helperId}>
        {hasUnsupported ? (
          <p>현재 Meetdle은 서울 지하철 1~9호선 역만 지원해요.</p>
        ) : (
          !isDestination &&
          (!hasQuery || results.length > 0) && <p>* 서울 지하철 1~9호선 역을 검색할 수 있어요.</p>
        )}
        {isDestination && (
          <>
            <p>집이 아니어도 괜찮아요. 약속 후 이동할 역을 알려주세요.</p>
            <p>* 출발역과 같은 역을 선택해도 괜찮아요.</p>
          </>
        )}
      </div>
      <span className="schedule-transit__sr-only" role="status">
        {hasQuery
          ? `검색 결과 ${results.length}개${value.station ? `, ${value.station.name} 선택됨` : ''}`
          : '검색어를 입력해주세요.'}
      </span>
    </section>
  );
}

export default StationSearch;
