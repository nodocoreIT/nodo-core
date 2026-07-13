"use client";

import DatePicker, { registerLocale } from "react-datepicker";
import { es } from "date-fns/locale/es";
import "react-datepicker/dist/react-datepicker.css";
import "./datepicker-custom.css";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import CustomSelect from "./CustomSelect";

registerLocale("es", es);

interface Props {
  value: string; // Formato YYYY-MM-DD
  onChange: (value: string) => void;
  label?: string;
}

export default function BirthdayPicker({ value, onChange, label }: Props) {
  const selectedDate = value ? new Date(value + "T12:00:00") : null;

  const years = Array.from({ length: 85 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { value: y.toString(), label: y.toString() };
  });

  const months = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ].map((m, i) => ({ value: i.toString(), label: m }));

  const handleChange = (date: Date | null) => {
    if (date) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      onChange(`${yyyy}-${mm}-${dd}`);
    } else {
      onChange("");
    }
  };

  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-luxury-gray-light text-xs uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative birthday-picker-container">
        <DatePicker
          selected={selectedDate}
          onChange={handleChange}
          locale="es"
          dateFormat="dd/MM/yyyy"
          placeholderText="Seleccionar fecha"
          maxDate={new Date()}
          renderCustomHeader={({
            date,
            changeYear,
            changeMonth,
            decreaseMonth,
            increaseMonth,
            prevMonthButtonDisabled,
            nextMonthButtonDisabled,
          }) => (
            <div className="flex items-center justify-between px-2 py-2 gap-2 bg-[#111111]">
              <button
                type="button"
                onClick={decreaseMonth}
                disabled={prevMonthButtonDisabled}
                className="text-gold hover:bg-gold/10 p-1 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              
              <div className="flex gap-1 flex-1">
                <div className="flex-1">
                  <CustomSelect
                    value={date.getMonth().toString()}
                    onChange={(val) => changeMonth(parseInt(val))}
                    options={months}
                    placeholder="Mes"
                  />
                </div>
                <div className="w-[85px]">
                  <CustomSelect
                    value={date.getFullYear().toString()}
                    onChange={(val) => changeYear(parseInt(val))}
                    options={years}
                    placeholder="Año"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={increaseMonth}
                disabled={nextMonthButtonDisabled}
                className="text-gold hover:bg-gold/10 p-1 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
          className="w-full bg-black border border-luxury-gray-mid text-white px-3 py-2.5 text-sm focus:outline-none focus:border-gold transition-colors cursor-pointer"
          calendarClassName="custom-datepicker"
          wrapperClassName="w-full"
        />
        <CalendarIcon 
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555555] pointer-events-none" 
          size={16} 
        />
      </div>
    </div>
  );
}
