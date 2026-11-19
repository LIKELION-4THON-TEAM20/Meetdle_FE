import { useEffect, useState } from 'react';
import { searchStations } from '../../../api/rooms';
import StationSearch from '../components/StationSearch';
import { normalizeStationQuery } from '../scheduleUtils';
import type { Station, StationSearchValue } from '../types';
import { invalidScheduleResponse, toUiStation } from './model';
import { scheduleErrorMessage } from './errors';

export default function ApiStationSearch({
  kind,
  value,
  onChange,
}: {
  kind: 'departure' | 'destination';
  value: StationSearchValue;
  onChange: (value: StationSearchValue) => void;
}) {
  const query = value.query.trim();
  const [attempt, setAttempt] = useState(0);
  const selected =
    value.station && normalizeStationQuery(value.station.name) === normalizeStationQuery(query)
      ? value.station
      : null;
  const key = `${query}:${attempt}`;
  const [response, setResponse] = useState<{ key: string; items: Station[]; error: string }>({
    key: '',
    items: [],
    error: '',
  });
  useEffect(() => {
    if (!query || query.length > 40 || selected) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      Promise.resolve()
        .then(() => searchStations({ q: query, limit: 10 }, controller.signal))
        .then((result) => {
          if (!Array.isArray(result?.items))
            invalidScheduleResponse('Invalid station search response');
          return result.items.map(toUiStation);
        })
        .then(
          (items) => {
            if (!controller.signal.aborted) setResponse({ key, items, error: '' });
          },
          (error) => {
            if (!controller.signal.aborted)
              setResponse({ key, items: [], error: scheduleErrorMessage(error) });
          },
        );
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, selected, key]);
  const current = response.key === key ? response : null;
  return (
    <StationSearch
      kind={kind}
      stations={[]}
      value={value}
      onChange={onChange}
      results={selected ? [selected] : (current?.items ?? [])}
      loading={!!query && !selected && !current && query.length <= 40}
      error={
        query.length > 40
          ? '역 이름은 40자 이내로 입력해주세요.'
          : selected
            ? undefined
            : current?.error
      }
      onRetry={() => setAttempt((value) => value + 1)}
    />
  );
}
