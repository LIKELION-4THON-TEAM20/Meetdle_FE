import { useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import deleteIcon from '../../../assets/icons/home/delete.svg';
import users from '../../../assets/icons/home/users.svg';
import calendar from '../../../assets/icons/home/calendar.svg';
import chevron from '../../../assets/icons/home/chevron.svg';
import type { Appointment } from '../appointment.types';
import { Link } from 'react-router';
import { formatAppointmentDate, getAppointmentBadge } from '../appointment.utils';

interface AppointmentCardProps {
  appointment: Appointment;
  today: string;
  deleteMode: boolean;
  onRevealDelete: () => void;
  onHideDelete: () => void;
  onDelete: () => void;
}

function AppointmentCard({
  appointment,
  today,
  deleteMode,
  onRevealDelete,
  onHideDelete,
  onDelete,
}: AppointmentCardProps) {
  const gesture = useRef<{
    pointerId: number;
    x: number;
    y: number;
    start: number;
    horizontal: boolean;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const suppressClick = useRef(false);
  const reveal = dragOffset ?? (deleteMode ? 48 : 0);
  const isCompleted = appointment.status === 'completed';
  const badge = appointment.badgeLabel ?? getAppointmentBadge(appointment, today);

  const card = (
    <article
      className={`appointment-card${isCompleted ? ' appointment-card--completed' : ''}${deleteMode ? ' appointment-card--delete' : ''}`}
      aria-labelledby={`appointment-${appointment.id}`}
    >
      <div className="appointment-card__details">
        <div className="appointment-card__title-row">
          <span
            className="appointment-card__badge"
            aria-label={`${isCompleted ? '완료' : '진행 중'}, ${badge}`}
          >
            {badge}
          </span>
          <h2 id={`appointment-${appointment.id}`}>{appointment.name}</h2>
        </div>
        <div className="appointment-card__bottom-row">
          <div className="appointment-card__meta">
            <span>
              <img src={users} alt="참여 인원" draggable={false} />
              {appointment.participants.length}명
            </span>
            <span className="appointment-card__date">
              <span className="appointment-card__calendar">
                <img src={calendar} alt="" draggable={false} />
              </span>
              <time dateTime={appointment.date}>{formatAppointmentDate(appointment.date)}</time>
            </span>
          </div>
          <div className="appointment-card__avatars" role="group" aria-label="참여자">
            {appointment.participants
              .slice(0, 4)
              .map((participant) =>
                participant.imageUrl ? (
                  <img
                    key={participant.id}
                    className="appointment-card__avatar"
                    src={participant.imageUrl}
                    alt={participant.name}
                    draggable={false}
                  />
                ) : (
                  <span
                    key={participant.id}
                    className="appointment-card__avatar"
                    role="img"
                    aria-label={`${participant.name}, 프로필 이미지 없음`}
                  />
                ),
              )}
          </div>
        </div>
      </div>
      <span className="appointment-card__chevron" aria-hidden="true">
        <img src={chevron} alt="" draggable={false} />
      </span>
    </article>
  );
  return (
    <div
      className={`appointment-card-container${dragOffset !== null ? ' appointment-card-container--dragging' : ''}`}
      style={{ '--delete-reveal': `${reveal}px`, '--delete-opacity': reveal / 48 } as CSSProperties}
      onPointerDown={(event) => {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          (event.target as HTMLElement).closest('button')
        )
          return;
        suppressClick.current = false;
        gesture.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          start: deleteMode ? 48 : 0,
          horizontal: false,
        };
      }}
      onPointerMove={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.x;
        const dy = event.clientY - current.y;
        if (!current.horizontal) {
          if (Math.abs(dy) > 8 && Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          if (Math.abs(dx) <= 8) return;
          current.horizontal = true;
          suppressClick.current = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        setDragOffset(Math.max(0, Math.min(48, current.start - dx)));
      }}
      onPointerUp={(event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        if (current.horizontal) {
          const offset = Math.max(0, Math.min(48, current.start - (event.clientX - current.x)));
          if (offset >= 24) onRevealDelete();
          else onHideDelete();
        }
        gesture.current = null;
        setDragOffset(null);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setDragOffset(null);
      }}
      onLostPointerCapture={(event) => {
        // 터치는 누른 자식 요소에 암묵적으로 캡처된다. 부모로 캡처를 옮길 때
        // 자식의 lostpointercapture가 버블링해도 진행 중인 스와이프를 유지한다.
        if (
          event.target !== event.currentTarget ||
          event.currentTarget.hasPointerCapture(event.pointerId)
        )
          return;
        gesture.current = null;
        setDragOffset(null);
      }}
      onDragStart={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (suppressClick.current && !(event.target as HTMLElement).closest('button')) {
          event.preventDefault();
          event.stopPropagation();
          suppressClick.current = false;
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onRevealDelete();
      }}
    >
      {appointment.entryPath ? (
        <Link className="appointment-card-container__link" to={appointment.entryPath}>
          {card}
        </Link>
      ) : (
        card
      )}
      <button
        type="button"
        className={`appointment-card-delete${reveal > 0 ? ' appointment-card-delete--visible' : ''}`}
        aria-label={`${appointment.name} 삭제`}
        onClick={onDelete}
      >
        <img src={deleteIcon} alt="" draggable={false} />
      </button>
    </div>
  );
}

export default AppointmentCard;
