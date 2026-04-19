import './Card.css';

const Card = ({ children, title, className = '', headerAction, onClick }) => {
  return (
    <div 
      className={`card ${className} ${onClick ? 'clickable' : ''} animate-fade-in`}
      onClick={onClick}
    >
      {(title || headerAction) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {headerAction && <div className="card-action">{headerAction}</div>}
        </div>
      )}
      <div className="card-body">
        {children}
      </div>
    </div>
  );
};

export default Card;
