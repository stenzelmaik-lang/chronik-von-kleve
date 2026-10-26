"use client";
import { useState } from 'react';
import styles from './story-workspace.module.css';

export function PreparationPicker({label, values, options, onChange}: {
  label: string; values: string[];
  options: {id: string; title: string; type?: string; summary?: string}[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState(''), [type, setType] = useState('');
  const types = [...new Set(options.map(option => option.type).filter(Boolean))];
  const visible = options.filter(option => (!type || option.type === type) &&
    `${option.title} ${option.summary || ''} ${option.id}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => Number(values.includes(b.id)) - Number(values.includes(a.id)));
  return <fieldset className={styles.pick}><legend>{label}</legend>
    <input aria-label={label + ' suchen'} placeholder="Vorhandene Akte suchen …" value={search} onChange={event => setSearch(event.target.value)}/>
    {types.length > 1 && <select aria-label={label + ' nach Typ filtern'} value={type} onChange={event => setType(event.target.value)}><option value="">Alle Typen</option>{types.map(value => <option key={value} value={value}>{value}</option>)}</select>}
    {visible.map(option => <label key={option.id}><input type="checkbox" checked={values.includes(option.id)} onChange={event => onChange(event.target.checked ? [...values, option.id] : values.filter(id => id !== option.id))}/><span>{option.title}<small>{[option.type, option.summary, option.id].filter(Boolean).join(' · ')}</small></span></label>)}
    {!visible.length && <p>{options.length ? 'Keine passenden Akten gefunden.' : 'Noch keine passenden zentralen Akten vorhanden.'}</p>}
  </fieldset>;
}
