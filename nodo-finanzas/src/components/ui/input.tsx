import React from 'react';
import { FormSelect } from '@nodocore/shared-components';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2)}`;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`w-full px-3 py-2 rounded-lg border text-sm transition-colors outline-none
            ${error
              ? 'border-red-400 focus:border-red-500 focus:ring-1 focus:ring-red-400'
              : 'border-mist focus:border-brand focus:ring-1 focus:ring-brand'
            }
            ${className}`}
          {...rest}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';

interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  options?: Array<{ value: string; label: string }>;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  allowEmpty?: boolean;
  emptyLabel?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, className = '', id, children, value, onChange, disabled, defaultValue, name, allowEmpty, emptyLabel, ...rest }, ref) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2)}`;
    const [internal, setInternal] = React.useState(String(value ?? defaultValue ?? ''));

    React.useEffect(() => {
      if (value !== undefined) setInternal(String(value));
    }, [value]);

    const handleChange = (next: string) => {
      setInternal(next);
      if (onChange) {
        onChange({
          target: { value: next, name },
          currentTarget: { value: next, name },
        } as React.ChangeEvent<HTMLSelectElement>);
      }
    };

    const selectOptions =
      options ??
      (children
        ? Array.from(
            (children as React.ReactElement<{ value?: string; children?: React.ReactNode }>[]).map(
              (child) => ({
                value: String(child.props.value ?? child.props.children ?? ''),
                label: String(child.props.children ?? child.props.value ?? ''),
              }),
            ),
          )
        : []);

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-ink">
            {label}
          </label>
        )}
        <FormSelect
          id={selectId}
          value={internal}
          onChange={handleChange}
          options={selectOptions}
          disabled={disabled}
          allowEmpty={allowEmpty}
          emptyLabel={emptyLabel}
          aria-label={label ?? rest['aria-label']}
        />
        <select
          ref={ref}
          name={name}
          value={internal}
          onChange={() => undefined}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          {...rest}
        >
          {selectOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
