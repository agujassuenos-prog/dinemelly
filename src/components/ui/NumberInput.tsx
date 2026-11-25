import React, { useEffect, useRef, useState } from 'react';

interface BaseProps {
  allowDecimal?: boolean;
  emptyWhenZero?: boolean;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  'aria-label'?: string;
  id?: string;
  name?: string;
}

interface NumberValueProps extends BaseProps {
  value: number;
  onChangeValue: (val: number) => void;
  onChangeText?: never;
}

interface StringValueProps extends BaseProps {
  value: string;
  onChangeText: (text: string) => void;
  onChangeValue?: never;
}

export type NumberInputProps = NumberValueProps | StringValueProps;

function formatNumberProp(val: number | string, emptyWhenZero: boolean): string {
  if (typeof val === 'string') return val;
  if (!Number.isFinite(val)) return '';
  if (emptyWhenZero && val === 0) return '';
  return String(val);
}

export const NumberInput: React.FC<NumberInputProps> = (props) => {
  const {
    allowDecimal = true,
    emptyWhenZero = false,
    className = '',
    placeholder,
    disabled,
    required,
    id,
    name,
  } = props;

  const isStringMode = typeof props.onChangeText === 'function';

  const [localText, setLocalText] = useState<string>(() =>
    formatNumberProp(props.value, emptyWhenZero)
  );

  const lastEmittedNumRef = useRef<number | null>(
    typeof props.value === 'number' ? props.value : null
  );

  useEffect(() => {
    if (isStringMode) {
      const strVal = typeof props.value === 'string' ? props.value : String(props.value ?? '');
      if (strVal !== localText) {
        setLocalText(strVal);
      }
      return;
    }

    const numVal = typeof props.value === 'number' ? props.value : 0;
    if (numVal !== lastEmittedNumRef.current) {
      lastEmittedNumRef.current = numVal;
      setLocalText(formatNumberProp(numVal, emptyWhenZero));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.value, isStringMode, emptyWhenZero]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value;

    if (allowDecimal) {
      raw = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '');
      const dotIdx = raw.indexOf('.');
      if (dotIdx !== -1) {
        raw = raw.slice(0, dotIdx + 1) + raw.slice(dotIdx + 1).replace(/\./g, '');
      }
    } else {
      raw = raw.replace(/\D/g, '');
    }

    // Evita ceros a la izquierda pegados (ej. "035000" -> "35000"), manteniendo "0" y "0.xx"
    if (raw.length > 1 && raw[0] === '0' && raw[1] !== '.') {
      raw = raw.replace(/^0+/, '') || '0';
    }

    setLocalText(raw);

    if (props.onChangeText) {
      props.onChangeText(raw);
      return;
    }

    if (props.onChangeValue) {
      const parsed = raw === '' || raw === '.' ? 0 : parseFloat(raw);
      const safeNum = Number.isFinite(parsed) ? parsed : 0;
      lastEmittedNumRef.current = safeNum;
      props.onChangeValue(safeNum);
    }
  };

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={localText}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      aria-label={props['aria-label']}
      autoComplete="off"
      className={className}
    />
  );
};
