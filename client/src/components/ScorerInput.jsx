import { useEffect, useState } from "react";

export function ScorerInput({ name = "answer", value, disabled = false, placeholder = "Nombre y apellido del jugador" }) {
  const [currentValue, setCurrentValue] = useState(value || "");

  useEffect(() => {
    setCurrentValue(value || "");
  }, [value]);

  return (
    <div className="scorer-input">
      <input
        name={name}
        value={currentValue}
        onChange={(event) => setCurrentValue(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        required
      />
      <small className="scorer-input__status">Escribe el nombre que quieras. Al evaluar se revisarán coincidencias y nombres parecidos.</small>
    </div>
  );
}
