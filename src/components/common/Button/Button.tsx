import type { ButtonHTMLAttributes } from 'react';
import './Button.scss';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary';
}

function Button({ variant = 'primary', type = 'button', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`common-button common-button--${variant}${className ? ` ${className}` : ''}`}
    />
  );
}

export default Button;
