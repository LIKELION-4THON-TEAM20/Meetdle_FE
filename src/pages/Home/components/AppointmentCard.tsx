import users from '../../../assets/icons/home/users.svg';
import calendar from '../../../assets/icons/home/calendar.svg';
import chevron from '../../../assets/icons/home/chevron.svg';
import type { Appointment } from '../appointment.types';
import { formatAppointmentDate, getAppointmentBadge } from '../appointment.utils';

interface AppointmentCardProps {
  appointment: Appointment;
  today: string;
}

function AppointmentCard({ appointment, today }: AppointmentCardProps) {
  const isCompleted = appointment.status === 'completed';

  return (
    <article
      className={`appointment-card${isCompleted ? ' appointment-card--completed' : ''}`}
      aria-labelledby={`appointment-${appointment.id}`}
    >
      <div className="appointment-card__details">
        <div className="appointment-card__title-row">
          <span
            className="appointment-card__badge"
            aria-label={`${isCompleted ? '완료' : '진행 중'}, ${getAppointmentBadge(appointment, today)}`}
          >
            {getAppointmentBadge(appointment, today)}
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
}

export default AppointmentCard;
