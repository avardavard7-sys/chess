'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Header from '@/components/Header';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

type City = { id: string; name: string };
type Section = { id: string; city_id: string; name: string };
type Org = { id: string; section_id: string; name: string };
type Student = {
  id: string; org_id: string; full_name: string; birth_year: number | null;
  rating: number; trainer_name: string | null; school: string | null;
  achievements: string | null; comments: string | null;
  photo_url: string | null;
  rating_history: Array<{ date: string; rating: number }>;
};

// Сжатие фото: ресайз до 400x400, JPEG quality 0.7 → ~20-50 KB
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxSize = 400;
        let w = img.width, h = img.height;
        if (w > h && w > maxSize) { h = (h * maxSize) / w; w = maxSize; }
        else if (h > maxSize) { w = (w * maxSize) / h; h = maxSize; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('no ctx');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Казахский орнамент SVG
const KazakhPattern = () => (
  <svg className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <pattern id="kz-pattern" x="0" y="0" width="80" height="80" patternUnits="userSpaceOnUse">
        <path d="M40 10 L50 30 L70 30 L55 45 L60 65 L40 55 L20 65 L25 45 L10 30 L30 30 Z" fill="#ffd700" opacity="0.6"/>
        <circle cx="40" cy="40" r="3" fill="#1a8fe3"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#kz-pattern)"/>
  </svg>
);

// Солнце флага
const KazakhSun = ({ size = 120 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="100" r="35" fill="#ffd700"/>
    {Array.from({ length: 32 }).map((_, i) => {
      const angle = (i * 360) / 32;
      return (
        <rect key={i} x="99" y="40" width="2" height="25" fill="#ffd700"
          transform={`rotate(${angle} 100 100)`} />
      );
    })}
    <path d="M 100 140 Q 80 155 85 175 Q 100 165 115 175 Q 120 155 100 140 Z" fill="#ffd700" transform="translate(0, -5)"/>
  </svg>
);

export default function NationalRatingPage() {
  const [loading, setLoading] = useState(true);
  const [canEditGlobal, setCanEditGlobal] = useState(false);
  const [myOrgEditorIds, setMyOrgEditorIds] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  const [cities, setCities] = useState<City[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const [currentCity, setCurrentCity] = useState<City | null>(null);
  const [currentSection, setCurrentSection] = useState<Section | null>(null);
  const [currentOrg, setCurrentOrg] = useState<Org | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const [citySearch, setCitySearch] = useState('');
  const [studentSearch, setStudentSearch] = useState(''); // поиск внутри города

  const loadAll = useCallback(async () => {
    const [c, s, o, st] = await Promise.all([
      supabase.from('national_cities').select('*').order('name'),
      supabase.from('national_sections').select('*').order('name'),
      supabase.from('national_orgs').select('*').order('name'),
      supabase.from('national_students').select('*').order('full_name'),
    ]);
    setCities(c.data || []);
    setSections(s.data || []);
    setOrgs(o.data || []);
    setStudents(st.data || []);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        const { data: prof } = await supabase.from('profiles')
          .select('can_edit_national_rating').eq('id', session.user.id).maybeSingle();
        setCanEditGlobal(prof?.can_edit_national_rating === true);
        const { data: editors } = await supabase.from('national_org_editors')
          .select('org_id').eq('user_id', session.user.id);
        setMyOrgEditorIds(new Set((editors || []).map((e: any) => e.org_id)));
      }
      await loadAll();
      setLoading(false);
    };
    init();
  }, [loadAll]);

  const canEditOrg = (orgId: string) => canEditGlobal || myOrgEditorIds.has(orgId);

  // Добавление/удаление
  const addCity = async () => {
    const name = prompt('Название города:');
    if (!name?.trim()) return;
    await supabase.from('national_cities').insert({ name: name.trim() });
    loadAll();
  };
  const deleteCity = async (c: City) => {
    if (!confirm(`Удалить "${c.name}" со всеми разделами и учениками?`)) return;
    await supabase.from('national_cities').delete().eq('id', c.id);
    if (currentCity?.id === c.id) setCurrentCity(null);
    loadAll();
  };
  const addSection = async () => {
    if (!currentCity) return;
    const name = prompt('Название раздела (Академии / Школы / Клубы / ...):');
    if (!name?.trim()) return;
    await supabase.from('national_sections').insert({ city_id: currentCity.id, name: name.trim() });
    loadAll();
  };
  const deleteSection = async (s: Section) => {
    if (!confirm(`Удалить раздел "${s.name}"?`)) return;
    await supabase.from('national_sections').delete().eq('id', s.id);
    if (currentSection?.id === s.id) setCurrentSection(null);
    loadAll();
  };
  const addOrg = async () => {
    if (!currentSection) return;
    const name = prompt('Название организации (школа / академия / клуб):');
    if (!name?.trim()) return;
    await supabase.from('national_orgs').insert({ section_id: currentSection.id, name: name.trim() });
    loadAll();
  };
  const deleteOrg = async (o: Org) => {
    if (!confirm(`Удалить "${o.name}"?`)) return;
    await supabase.from('national_orgs').delete().eq('id', o.id);
    if (currentOrg?.id === o.id) setCurrentOrg(null);
    loadAll();
  };
  const addStudent = async () => {
    if (!currentOrg) return;
    const fn = prompt('ФИО ученика:');
    if (!fn?.trim()) return;
    const yr = prompt('Год рождения (опционально):');
    const rt = prompt('Рейтинг:', '0');
    await supabase.from('national_students').insert({
      org_id: currentOrg.id,
      full_name: fn.trim(),
      birth_year: yr ? parseInt(yr) : null,
      rating: rt ? parseInt(rt) : 0,
      rating_history: [],
    });
    loadAll();
  };
  const updateStudent = async (field: keyof Student, value: any) => {
    if (!selectedStudent) return;
    const updates: any = { [field]: value };
    if (field === 'rating') {
      const hist = [...(selectedStudent.rating_history || []), { date: new Date().toLocaleDateString('ru-RU'), rating: value }];
      updates.rating_history = hist;
    }
    await supabase.from('national_students').update(updates).eq('id', selectedStudent.id);
    loadAll();
    // Обновляем локально
    setSelectedStudent({ ...selectedStudent, ...updates });
  };
  const deleteStudent = async () => {
    if (!selectedStudent || !confirm(`Удалить "${selectedStudent.full_name}"?`)) return;
    await supabase.from('national_students').delete().eq('id', selectedStudent.id);
    setSelectedStudent(null);
    loadAll();
  };

  // Импорт XLSX
  const importXLSX = async (file: File) => {
    if (!currentOrg) return;
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(ws);
    const toInsert = rows.map(r => ({
      org_id: currentOrg.id,
      full_name: String(r['ФИО'] || r['Имя'] || r['full_name'] || '').trim(),
      birth_year: r['Год рождения'] ? parseInt(String(r['Год рождения'])) : (r['birth_year'] ? parseInt(String(r['birth_year'])) : null),
      rating: r['Рейтинг'] ? parseInt(String(r['Рейтинг'])) : (r['rating'] ? parseInt(String(r['rating'])) : 0),
      trainer_name: String(r['Тренер'] || r['trainer_name'] || '').trim() || null,
      school: String(r['Школа'] || r['school'] || '').trim() || null,
      achievements: String(r['Достижения'] || r['achievements'] || '').trim() || null,
      comments: String(r['Комментарии'] || r['comments'] || '').trim() || null,
      rating_history: [],
    })).filter(r => r.full_name);
    if (toInsert.length === 0) { alert('В файле нет записей'); return; }
    const { error } = await supabase.from('national_students').insert(toInsert);
    if (error) alert('Ошибка: ' + error.message);
    else alert(`✅ Добавлено ${toInsert.length} учеников`);
    loadAll();
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([{
      'ФИО': 'Иванов Иван Иванович',
      'Год рождения': 2012,
      'Рейтинг': 1200,
      'Тренер': 'Петров П.П.',
      'Школа': 'СОШ №5',
      'Достижения': 'Чемпион города 2024',
      'Комментарии': 'Активный ученик',
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ученики');
    XLSX.writeFile(wb, 'national_rating_template.xlsx');
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
        <KazakhSun size={80} />
      </motion.div>
    </div>
  );

  // Поиск учеников в выбранном городе (по всем школам)
  const citySections = currentCity ? sections.filter(s => s.city_id === currentCity.id) : [];
  const citySectionIds = new Set(citySections.map(s => s.id));
  const cityOrgs = orgs.filter(o => citySectionIds.has(o.section_id));
  const cityOrgIds = new Set(cityOrgs.map(o => o.id));
  const citySearchResults = currentCity && studentSearch.trim()
    ? students.filter(st => cityOrgIds.has(st.org_id) && st.full_name.toLowerCase().includes(studentSearch.toLowerCase()))
    : [];

  const filteredCities = cities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase()));
  const currentSectionOrgs = currentSection ? orgs.filter(o => o.section_id === currentSection.id) : [];
  const currentOrgStudents = currentOrg ? students.filter(st => st.org_id === currentOrg.id) : [];

  return (
    <div className="min-h-screen relative" style={{ background: 'linear-gradient(180deg, #0a1628 0%, #1a3a5c 100%)' }}>
      <KazakhPattern />
      <Header />
      <main className="pt-24 pb-12 px-4 relative">
        <div className="max-w-4xl mx-auto">
          {/* Заголовок */}
          <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center justify-center gap-4 mb-3">
              <KazakhSun size={60} />
              <h1 className="text-4xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: '#ffd700' }}>
                Национальный рейтинг
              </h1>
              <KazakhSun size={60} />
            </div>
            <p className="text-sm" style={{ color: '#1a8fe3' }}>🇰🇿 Қазақстан шахмат рейтингі</p>
          </motion.div>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm mb-6 text-white/60 flex-wrap">
            <button onClick={() => { setCurrentCity(null); setCurrentSection(null); setCurrentOrg(null); setSelectedStudent(null); setStudentSearch(''); }}
              className="hover:text-yellow-400">🇰🇿 Города</button>
            {currentCity && <>
              <span>›</span>
              <button onClick={() => { setCurrentSection(null); setCurrentOrg(null); setSelectedStudent(null); }}
                className="hover:text-yellow-400">{currentCity.name}</button>
            </>}
            {currentSection && <>
              <span>›</span>
              <button onClick={() => { setCurrentOrg(null); setSelectedStudent(null); }}
                className="hover:text-yellow-400">{currentSection.name}</button>
            </>}
            {currentOrg && <>
              <span>›</span>
              <span style={{ color: '#ffd700' }}>{currentOrg.name}</span>
            </>}
          </div>

          {/* === УРОВЕНЬ 1: ГОРОДА === */}
          {!currentCity && (
            <div>
              <div className="flex gap-2 mb-4 flex-wrap">
                <input value={citySearch} onChange={e => setCitySearch(e.target.value)} placeholder="🔍 Поиск города..."
                  className="flex-1 px-4 py-3 rounded-xl text-white placeholder-white/40 text-sm"
                  style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }} />
                {canEditGlobal && (
                  <button onClick={addCity} className="px-4 py-3 rounded-xl text-sm font-semibold"
                    style={{ background: '#ffd700', color: '#0a1628' }}>+ Город</button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredCities.map(c => (
                  <motion.div key={c.id} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentCity(c)}
                    className="relative p-5 rounded-xl cursor-pointer group"
                    style={{ background: 'linear-gradient(135deg, rgba(26,143,227,0.15), rgba(255,215,0,0.08))', border: '1px solid rgba(255,215,0,0.3)' }}>
                    <div className="text-lg font-bold text-white mb-1">🏙️ {c.name}</div>
                    <div className="text-xs text-white/50">
                      {sections.filter(s => s.city_id === c.id).length} разделов
                    </div>
                    {canEditGlobal && (
                      <button onClick={(e) => { e.stopPropagation(); deleteCity(c); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
                    )}
                  </motion.div>
                ))}
                {filteredCities.length === 0 && (
                  <div className="col-span-full text-center py-16 text-white/40">
                    <KazakhSun size={80} />
                    <p className="mt-4">Пока нет городов</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* === УРОВЕНЬ 2: РАЗДЕЛЫ + ПОИСК ПО УЧЕНИКАМ === */}
          {currentCity && !currentSection && (
            <div className="space-y-4">
              {/* Поиск ученика по всему городу */}
              <div className="p-4 rounded-xl" style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="text-xs text-yellow-400/80 mb-2">🔍 Не знаете школу? Найдите ученика по ФИО:</div>
                <input value={studentSearch} onChange={e => setStudentSearch(e.target.value)} placeholder="ФИО ученика..."
                  className="w-full px-3 py-2 rounded-lg text-white placeholder-white/30 text-sm"
                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.2)' }} />
                {citySearchResults.length > 0 && (
                  <div className="mt-3 space-y-2 max-h-[300px] overflow-y-auto">
                    {citySearchResults.map(st => {
                      const org = orgs.find(o => o.id === st.org_id);
                      const sec = org ? sections.find(s => s.id === org.section_id) : null;
                      return (
                        <div key={st.id} onClick={() => { setSelectedStudent(st); if (org) { setCurrentOrg(org); if (sec) setCurrentSection(sec); } }}
                          className="p-3 rounded-lg cursor-pointer hover:bg-white/5"
                          style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="text-sm font-bold text-white">{st.full_name}</div>
                              <div className="text-[10px] text-white/40">{sec?.name} · {org?.name}</div>
                            </div>
                            <div className="text-lg font-bold" style={{ color: '#ffd700' }}>{st.rating}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">Разделы в {currentCity.name}</h2>
                {canEditGlobal && (
                  <button onClick={addSection} className="px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: '#ffd700', color: '#0a1628' }}>+ Раздел</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {citySections.map(s => (
                  <motion.div key={s.id} whileHover={{ scale: 1.02 }} onClick={() => setCurrentSection(s)}
                    className="relative p-4 rounded-xl cursor-pointer group"
                    style={{ background: 'rgba(26,143,227,0.15)', border: '1px solid rgba(26,143,227,0.3)' }}>
                    <div className="font-bold text-white">📂 {s.name}</div>
                    <div className="text-xs text-white/50 mt-1">
                      {orgs.filter(o => o.section_id === s.id).length} организаций
                    </div>
                    {canEditGlobal && (
                      <button onClick={(e) => { e.stopPropagation(); deleteSection(s); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* === УРОВЕНЬ 3: ОРГАНИЗАЦИИ === */}
          {currentSection && !currentOrg && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">{currentSection.name}</h2>
                {canEditGlobal && (
                  <button onClick={addOrg} className="px-3 py-2 rounded-lg text-xs font-semibold"
                    style={{ background: '#ffd700', color: '#0a1628' }}>+ Организация</button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentSectionOrgs.map(o => (
                  <motion.div key={o.id} whileHover={{ scale: 1.02 }} onClick={() => setCurrentOrg(o)}
                    className="relative p-4 rounded-xl cursor-pointer group"
                    style={{ background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.25)' }}>
                    <div className="font-bold text-white">🏢 {o.name}</div>
                    <div className="text-xs text-white/50 mt-1">
                      {students.filter(st => st.org_id === o.id).length} учеников
                    </div>
                    {canEditGlobal && (
                      <button onClick={(e) => { e.stopPropagation(); deleteOrg(o); }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-red-400 text-xs">✕</button>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* === УРОВЕНЬ 4: УЧЕНИКИ === */}
          {currentOrg && !selectedStudent && (
            <div className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <h2 className="text-xl font-bold text-white">{currentOrg.name}</h2>
                {canEditOrg(currentOrg.id) && (
                  <div className="flex gap-2">
                    <button onClick={addStudent} className="px-3 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: '#ffd700', color: '#0a1628' }}>+ Ученик</button>
                    <label className="px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                      style={{ background: '#1a8fe3', color: 'white' }}>
                      📥 Импорт XLSX
                      <input type="file" accept=".xlsx,.xls" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) importXLSX(f); e.target.value = ''; }} />
                    </label>
                    <button onClick={downloadTemplate} className="px-3 py-2 rounded-lg text-xs border"
                      style={{ borderColor: 'rgba(255,215,0,0.3)', color: '#ffd700' }}>📋 Шаблон</button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {currentOrgStudents.length === 0 && (
                  <div className="text-center py-12 text-white/40">Учеников пока нет</div>
                )}
                {currentOrgStudents.map(st => (
                  <motion.div key={st.id} whileHover={{ scale: 1.01 }} onClick={() => setSelectedStudent(st)}
                    className="p-3 rounded-lg cursor-pointer flex justify-between items-center gap-3"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,215,0,0.15)' }}>
                    {st.photo_url ? (
                      <img src={st.photo_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid rgba(255,215,0,0.3)' }} />
                    ) : (
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,215,0,0.1)' }}>
                        <span className="text-lg">👤</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white truncate">{st.full_name}</div>
                      <div className="text-xs text-white/40 truncate">
                        {st.birth_year && `${st.birth_year} г.р.`}
                        {st.trainer_name && ` · Тренер: ${st.trainer_name}`}
                      </div>
                    </div>
                    <div className="text-xl font-bold flex-shrink-0" style={{ color: '#ffd700' }}>{st.rating}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* === УРОВЕНЬ 5: КАРТОЧКА УЧЕНИКА === */}
          {selectedStudent && (
            <div className="space-y-4">
              <button onClick={() => setSelectedStudent(null)} className="text-sm text-white/60 hover:text-yellow-400">← К списку</button>
              <div className="p-6 rounded-2xl space-y-4"
                style={{ background: 'linear-gradient(135deg, rgba(26,143,227,0.1), rgba(255,215,0,0.05))', border: '1px solid rgba(255,215,0,0.3)' }}>
                <div className="flex items-start gap-4">
                  {/* Фото */}
                  <div className="relative flex-shrink-0">
                    {selectedStudent.photo_url ? (
                      <img src={selectedStudent.photo_url} alt={selectedStudent.full_name}
                        className="w-20 h-20 rounded-xl object-cover"
                        style={{ border: '2px solid rgba(255,215,0,0.4)' }} />
                    ) : (
                      <div className="w-20 h-20 rounded-xl flex items-center justify-center text-3xl"
                        style={{ background: 'rgba(255,215,0,0.1)', border: '2px dashed rgba(255,215,0,0.3)' }}>
                        👤
                      </div>
                    )}
                    {canEditOrg(selectedStudent.org_id) && (
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center cursor-pointer text-xs"
                        style={{ background: '#ffd700', color: '#0a1628' }} title="Загрузить фото">
                        📷
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (!f) return;
                            try {
                              const compressed = await compressImage(f);
                              await updateStudent('photo_url', compressed);
                            } catch (err) {
                              alert('Ошибка загрузки фото');
                              console.error(err);
                            }
                          }} />
                      </label>
                    )}
                    {canEditOrg(selectedStudent.org_id) && selectedStudent.photo_url && (
                      <button
                        onClick={() => { if (confirm('Удалить фото?')) updateStudent('photo_url', null); }}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] bg-red-500 text-white"
                        title="Удалить фото"
                      >×</button>
                    )}
                  </div>
                  <div className="flex-1 flex justify-between items-start">
                    <div>
                      <div className="text-2xl font-bold text-white">{selectedStudent.full_name}</div>
                      {selectedStudent.birth_year && <div className="text-sm text-white/50">{selectedStudent.birth_year} г.р.</div>}
                    </div>
                    <div className="text-3xl font-bold" style={{ color: '#ffd700' }}>{selectedStudent.rating}</div>
                  </div>
                </div>

                {canEditOrg(selectedStudent.org_id) ? (
                  <div className="space-y-3">
                    {([
                      ['full_name', 'ФИО', 'text'],
                      ['birth_year', 'Год рождения', 'number'],
                      ['rating', 'Рейтинг', 'number'],
                      ['trainer_name', 'Тренер', 'text'],
                      ['school', 'Школа обучения', 'text'],
                      ['achievements', 'Достижения', 'textarea'],
                      ['comments', 'Комментарии', 'textarea'],
                    ] as [keyof Student, string, string][]).map(([key, label, type]) => (
                      <div key={key}>
                        <div className="text-xs text-white/50 mb-1">{label}</div>
                        {type === 'textarea' ? (
                          <textarea defaultValue={(selectedStudent[key] as string) || ''}
                            onBlur={(e) => updateStudent(key, e.target.value.trim() || null)}
                            className="w-full px-3 py-2 rounded-lg text-sm text-white min-h-[60px]"
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.2)' }} />
                        ) : (
                          <input type={type} defaultValue={(selectedStudent[key] as any) ?? ''}
                            onBlur={(e) => {
                              const v = type === 'number' ? (e.target.value ? parseInt(e.target.value) : null) : (e.target.value.trim() || null);
                              updateStudent(key, v);
                            }}
                            className="w-full px-3 py-2 rounded-lg text-sm text-white"
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.2)' }} />
                        )}
                      </div>
                    ))}
                    <button onClick={deleteStudent} className="px-3 py-2 rounded-lg text-xs bg-red-500/15 text-red-400 border border-red-500/30">
                      🗑️ Удалить ученика
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    {selectedStudent.trainer_name && <div><span className="text-white/50">Тренер:</span> <span className="text-white">{selectedStudent.trainer_name}</span></div>}
                    {selectedStudent.school && <div><span className="text-white/50">Школа:</span> <span className="text-white">{selectedStudent.school}</span></div>}
                    {selectedStudent.achievements && <div><span className="text-white/50">Достижения:</span> <div className="text-white mt-1">{selectedStudent.achievements}</div></div>}
                    {selectedStudent.comments && <div><span className="text-white/50">Комментарии:</span> <div className="text-white mt-1">{selectedStudent.comments}</div></div>}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
