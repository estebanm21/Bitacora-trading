import React, { useState, useEffect } from 'react';
import {
    TrendingUp, DollarSign, Calendar, BarChart3, PieChart,
    Plus, Trash2, Download, Upload, Archive, ChevronRight,
    ArrowLeft, Save, Cloud, RefreshCw, Settings, X, Eye, EyeOff, Zap
} from 'lucide-react';
import {
    LineChart, Line, BarChart, Bar,
    PieChart as RePieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { supabase } from '../config/supabase';
import Swal from 'sweetalert2';
import TradeCalendar from './TradeCalendar';
import TradeChart from './TradeChart';

const TradingJournal = () => {
    const [view, setView] = useState('current');
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isBybitSyncing, setIsBybitSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);
    const [showBybitConfig, setShowBybitConfig] = useState(false);
    const [bybitConnected, setBybitConnected] = useState(false);
    const [bybitLastSync, setBybitLastSync] = useState(null);
    const [showApiSecret, setShowApiSecret] = useState(false);
    const [bybitForm, setBybitForm] = useState({ apiKey: '', apiSecret: '' });

    const [initialCapital, setInitialCapital] = useState(1000);
    const [trades, setTrades] = useState([]);
    const [monthlyHistory, setMonthlyHistory] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

    const [newTrade, setNewTrade] = useState({
        pair: '',
        action: 'Long 🟢',
        leverage: 1,
        result: 'win',
        amount: 0,
        date: new Date().toISOString().split('T')[0]
    });

    const [user, setUser] = useState(null);
    const [allTrades, setAllTrades] = useState([]);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [bybitCreds, setBybitCreds] = useState(null);

    // ─── Cargar credenciales Bybit cuando está conectado ────────────────────────
    useEffect(() => {
        if (bybitConnected && user) {
            supabase
                .from('trading_journal')
                .select('bybit_api_key, bybit_api_secret')
                .eq('auth_user_id', user.id)
                .single()
                .then(({ data }) => {
                    if (data?.bybit_api_key) {
                        setBybitCreds({ apiKey: data.bybit_api_key, apiSecret: data.bybit_api_secret });
                    }
                });
        }
    }, [bybitConnected, user]);

    // ─── Auth ───────────────────────────────────────────────────────────────────
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) loadFromCloud(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) loadFromCloud(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, []);

    // ─── Cargar desde Supabase ───────────────────────────────────────────────────
    const loadFromCloud = async (authUserId) => {
        try {
            setIsSyncing(true);
            const { data, error } = await supabase
                .from('trading_journal')
                .select('*')
                .eq('auth_user_id', authUserId)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('Error al cargar:', error);
                return;
            }

            if (data) {
                setInitialCapital(data.initial_capital || 1000);
                setTrades(data.trades || []);
                setMonthlyHistory(data.monthly_history || []);
                setCurrentMonth(data.current_month || new Date().toISOString().slice(0, 7));
                setLastSync(new Date(data.updated_at));
                setBybitConnected(data.bybit_connected || false);
                if (data.bybit_last_sync) setBybitLastSync(new Date(data.bybit_last_sync));
                // Si está conectado a Bybit, sincronizar automáticamente al abrir
                // if (data.bybit_connected) syncWithBybit();
                // if (data.bybit_connected) {
                //     setTimeout(() => syncWithBybit(), 1000);
                // }
                if (data.bybit_connected) syncWithBybit(authUserId);

            }
        } catch (error) {
            console.error('Error al cargar desde la nube:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // ─── Guardar en Supabase ─────────────────────────────────────────────────────
    const saveToCloud = async () => {
        if (!user) return;
        try {
            setIsSyncing(true);
            const { error } = await supabase
                .from('trading_journal')
                .upsert({
                    auth_user_id: user.id,
                    initial_capital: initialCapital,
                    trades,
                    monthly_history: monthlyHistory,
                    current_month: currentMonth,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'auth_user_id' });

            if (error) throw error;
            setLastSync(new Date());
        } catch (error) {
            console.error('Error al guardar:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Auto-guardar
    useEffect(() => {
        if (user && !isSyncing) {
            const timer = setTimeout(() => saveToCloud(), 2000);
            return () => clearTimeout(timer);
        }
    }, [trades, monthlyHistory, initialCapital, currentMonth, user]);

    // ─── Guardar credenciales Bybit ──────────────────────────────────────────────
    const saveBybitCredentials = async () => {
        if (!bybitForm.apiKey || !bybitForm.apiSecret) {
            Swal.fire({
                position: 'top-end', icon: 'info',
                text: 'Ingresa el API Key y API Secret',
                showConfirmButton: false, timer: 1500,
                background: '#030712', color: 'gray'
            });
            return;
        }

        try {
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bybit-sync`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // 'Authorization': `Bearer ${session.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        action: 'save_credentials',
                        authUserId: user.id,
                        apiKey: bybitForm.apiKey,
                        apiSecret: bybitForm.apiSecret,
                    })
                }
            );

            const result = await response.json();

            if (result.success) {
                setBybitConnected(true);
                setShowBybitConfig(false);
                setBybitForm({ apiKey: '', apiSecret: '' });
                Swal.fire({
                    position: 'top-end', icon: 'success',
                    text: '✅ Bybit conectado exitosamente',
                    showConfirmButton: false, timer: 1500,
                    background: '#030712', color: 'gray'
                });
                // Sincronizar inmediatamente
                syncWithBybit();
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            Swal.fire({
                position: 'top-end', icon: 'error',
                text: `Error al conectar: ${error.message}`,
                showConfirmButton: false, timer: 2000,
                background: '#030712', color: 'gray'
            });
        }
    };

    const syncWithBybit = async (overrideUserId = null) => {
        const userId = overrideUserId || user?.id;
        if (!userId) return;
        if (isBybitSyncing) return;

        try {
            setIsBybitSyncing(true);

            const { data: journal } = await supabase
                .from('trading_journal')
                .select('bybit_api_key, bybit_api_secret')
                .eq('auth_user_id', userId)
                .single();

            if (!journal?.bybit_api_key) {
                throw new Error('No hay credenciales de Bybit guardadas');
            }

            const key = journal.bybit_api_key;
            const secret = journal.bybit_api_secret;
            const recvWindow = '5000';

            // ── Firma Bybit ─────────────────────────────────────────────
            const bybitFetch = async (params) => {
                const ts = Date.now().toString();
                const signString = `${ts}${key}${recvWindow}${params}`;

                const enc = new TextEncoder();
                const cryptoKey = await window.crypto.subtle.importKey(
                    'raw',
                    enc.encode(secret),
                    { name: 'HMAC', hash: 'SHA-256' },
                    false,
                    ['sign']
                );

                const signatureBuffer = await window.crypto.subtle.sign(
                    'HMAC',
                    cryptoKey,
                    enc.encode(signString)
                );

                const signature = Array.from(new Uint8Array(signatureBuffer))
                    .map(b => b.toString(16).padStart(2, '0'))
                    .join('');

                const res = await fetch(
                    `https://api.bybit.com/v5/position/closed-pnl?${params}`,
                    {
                        headers: {
                            'X-BAPI-API-KEY': key,
                            'X-BAPI-TIMESTAMP': ts,
                            'X-BAPI-RECV-WINDOW': recvWindow,
                            'X-BAPI-SIGN': signature,
                        }
                    }
                );

                return res.json();
            };

            // ── 🔥 TRAER TODO EL HISTORIAL POR BLOQUES ───────────────────

            const now = Date.now();
            const daysBack = 180; // puedes subirlo (ej: 365)
            const chunkDays = 7;

            const chunkMs = chunkDays * 24 * 60 * 60 * 1000;

            let start = now - (daysBack * 24 * 60 * 60 * 1000);
            const end = now;

            let allResults = [];

            while (start < end) {
                const chunkEnd = Math.min(start + chunkMs, end);

                let cursor = null;
                let page = 0;

                do {
                    const params = `category=linear&settleCoin=USDT&limit=50&startTime=${start}&endTime=${chunkEnd}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;

                    const data = await bybitFetch(params);

                    if (data.retCode !== 0) {
                        throw new Error(`Bybit error: ${data.retMsg}`);
                    }

                    const list = data.result?.list || [];
                    allResults.push(...list);

                    cursor = data.result?.nextPageCursor;
                    page++;

                } while (cursor && page < 10);

                start = chunkEnd;
            }

            // ── ❗ eliminar duplicados (MUY IMPORTANTE) ─────────────────
            const uniqueMap = new Map();
            allResults.forEach(t => {
                uniqueMap.set(t.orderId, t);
            });

            const uniqueResults = Array.from(uniqueMap.values());

            console.log('TOTAL REAL:', uniqueResults.length);

            // ── Mapear ────────────────────────────────────────────────
            const allMapped = uniqueResults
                .map(t => ({
                    id: t.orderId,
                    pair: t.symbol,
                    action: t.side === 'Sell' ? 'Long 🟢' : 'Short 🔴',
                    leverage: parseInt(t.leverage) || 1,
                    result: parseFloat(t.closedPnl) >= 0 ? 'win' : 'loss',
                    amount: Math.abs(parseFloat(t.closedPnl || '0')),
                    date: new Date(parseInt(t.createdTime)).toISOString().split('T')[0],
                    fromBybit: true,
                    pnl: parseFloat(t.closedPnl || '0'),
                    entryPrice: parseFloat(t.avgEntryPrice || '0'),
                    exitPrice: parseFloat(t.avgExitPrice || '0'),
                    qty: parseFloat(t.closedSize || t.qty || '0'),
                    entryTime: t.createdTime ? new Date(parseInt(t.createdTime)).toISOString() : null,
                    exitTime: t.updatedTime ? new Date(parseInt(t.updatedTime)).toISOString() : null,
                    cumExitValue: parseFloat(t.cumExitValue || '0'),
                }))
                .filter(t => t.amount > 0); // puedes quitar esto si quieres TODOS

            setAllTrades(allMapped);

            // ── Mes actual ────────────────────────────────────────────
            const nowDate = new Date();
            const mesActual = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}`;

            const tradesDelMes = allMapped.filter(t => t.date.startsWith(mesActual));

            // ── Cierre automático si cambió el mes ────────────────────
            const storedMonth = currentMonth || mesActual;
            if (storedMonth !== mesActual) {
                const monthName = new Date(storedMonth + '-01').toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'long'
                });

                const tradesDelMesAnterior = allMapped.filter(t => t.date.startsWith(storedMonth));
                const statsDelMesAnterior = calculateStats(tradesDelMesAnterior, initialCapital);

                const monthData = {
                    id: Date.now(),
                    month: storedMonth,
                    monthName,
                    initialCapital,
                    trades: tradesDelMesAnterior,
                    stats: statsDelMesAnterior,
                    savedDate: new Date().toISOString()
                };

                setMonthlyHistory(prev => {
                    const yaExiste = prev.some(m => m.month === storedMonth);
                    return yaExiste ? prev : [monthData, ...prev];
                });

                Swal.fire({
                    position: 'top-end', icon: 'success',
                    text: `📅 Mes ${monthName} cerrado automáticamente. Actualiza tu capital inicial.`,
                    showConfirmButton: false, timer: 3000,
                    background: '#030712', color: 'gray'
                });
            }

            setTrades(tradesDelMes);
            setCurrentMonth(mesActual);
            setBybitLastSync(new Date());

            Swal.fire({
                position: 'top-end',
                icon: 'success',
                text: `🔄 ${allMapped.length} trades sincronizados`,
                showConfirmButton: false,
                timer: 2000,
                background: '#030712',
                color: 'gray'
            });

            await supabase
                .from('trading_journal')
                .update({ bybit_last_sync: new Date().toISOString() })
                .eq('auth_user_id', userId);

        } catch (error) {
            console.error('Error:', error);

            Swal.fire({
                position: 'top-end',
                icon: 'error',
                text: error.message,
                showConfirmButton: false,
                timer: 2000,
                background: '#030712',
                color: 'gray'
            });

        } finally {
            setIsBybitSyncing(false);
        }
    };

    // const syncWithBybit = async (overrideUserId = null) => {
    //     const userId = overrideUserId || user?.id;
    //     if (!userId) return;
    //     if (isBybitSyncing) return;

    //     try {
    //         setIsBybitSyncing(true);

    //         const { data: journal } = await supabase
    //             .from('trading_journal')
    //             .select('bybit_api_key, bybit_api_secret')
    //             .eq('auth_user_id', userId)
    //             .single();

    //         if (!journal?.bybit_api_key) {
    //             throw new Error('No hay credenciales de Bybit guardadas');
    //         }

    //         const key = journal.bybit_api_key;
    //         const secret = journal.bybit_api_secret;
    //         const recvWindow = '5000';

    //         // ── Función para hacer llamadas firmadas a Bybit ──────────────────
    //         const bybitFetch = async (params) => {
    //             const ts = Date.now().toString();
    //             const signString = `${ts}${key}${recvWindow}${params}`;
    //             const enc = new TextEncoder();
    //             const ck = await window.crypto.subtle.importKey(
    //                 'raw', enc.encode(secret),
    //                 { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    //             );
    //             const sb = await window.crypto.subtle.sign('HMAC', ck, enc.encode(signString));
    //             const sig = Array.from(new Uint8Array(sb))
    //                 .map(b => b.toString(16).padStart(2, '0')).join('');

    //             const res = await fetch(
    //                 `https://api.bybit.com/v5/position/closed-pnl?${params}`,
    //                 {
    //                     headers: {
    //                         'X-BAPI-API-KEY': key,
    //                         'X-BAPI-TIMESTAMP': ts,
    //                         'X-BAPI-RECV-WINDOW': recvWindow,
    //                         'X-BAPI-SIGN': sig,
    //                     }
    //                 }
    //             );
    //             return res.json();
    //         };

    //         // ── Paginación — traer todos los trades ───────────────────────────
    //         let allResults = [];
    //         let cursor = null;
    //         let page = 0;

    //         while (page < 10) {
    //             const params = `category=linear&limit=50&settleCoin=USDT${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    //             const data = await bybitFetch(params);

    //             if (data.retCode !== 0) throw new Error(`Bybit error: ${data.retMsg}`);

    //             const list = data.result?.list || [];
    //             allResults = [...allResults, ...list];
    //             cursor = data.result?.nextPageCursor;
    //             page++;

    //             if (!cursor || list.length < 50) break;
    //         }

    //         console.log('Total trades traídos:', allResults.length);
    //         console.log('Fechas:', allResults.map(t => new Date(parseInt(t.createdTime)).toISOString().split('T')[0]));
    //         const now = new Date();
    //         const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    //         // ── Mapear todos los trades ───────────────────────────────────────
    //         const allMapped = allResults
    //             .map(t => ({
    //                 id: t.orderId,
    //                 pair: t.symbol,
    //                 action: t.side === 'Sell' ? 'Short 🔴' : 'Long 🟢',
    //                 leverage: parseInt(t.leverage) || 1,
    //                 result: parseFloat(t.closedPnl) >= 0 ? 'win' : 'loss',
    //                 amount: Math.abs(parseFloat(t.closedPnl || '0')),
    //                 date: new Date(parseInt(t.createdTime)).toISOString().split('T')[0],
    //                 fromBybit: true,
    //                 pnl: parseFloat(t.closedPnl || '0'),
    //                 entryPrice: parseFloat(t.avgEntryPrice || '0'),
    //                 exitPrice: parseFloat(t.avgExitPrice || '0'),
    //             }))
    //             .filter(t => t.amount > 0);

    //         // Guardar TODOS para el calendario
    //         setAllTrades(allMapped);

    //         // Solo mes actual para estadísticas
    //         const tradesDelMes = allMapped.filter(t => t.date.startsWith(mesActual));

    //         // ── Cierre automático si cambió el mes ────────────────────────────
    //         const storedMonth = currentMonth || mesActual;
    //         if (storedMonth !== mesActual && trades.length > 0) {
    //             const monthName = new Date(storedMonth + '-01').toLocaleDateString('es-ES', {
    //                 year: 'numeric', month: 'long'
    //             });

    //             const statsDelMesAnterior = calculateStats(trades, initialCapital);
    //             const monthData = {
    //                 id: Date.now(),
    //                 month: storedMonth,
    //                 monthName,
    //                 initialCapital,
    //                 trades: [...trades],
    //                 stats: statsDelMesAnterior,
    //                 savedDate: new Date().toISOString()
    //             };

    //             setMonthlyHistory(prev => [monthData, ...prev]);
    //             setCurrentMonth(mesActual);
    //             setInitialCapital(0);
    //             setTrades(tradesDelMes);

    //             Swal.fire({
    //                 position: 'top-end', icon: 'success',
    //                 text: `📅 Mes ${monthName} cerrado automáticamente. Actualiza tu capital inicial.`,
    //                 showConfirmButton: false, timer: 3000,
    //                 background: '#030712', color: 'gray'
    //             });
    //         } else {
    //             setCurrentMonth(mesActual);
    //             setTrades(tradesDelMes);
    //         }

    //         setBybitLastSync(new Date());

    //         if (tradesDelMes.length > 0) {
    //             Swal.fire({
    //                 position: 'top-end', icon: 'success',
    //                 text: `🔄 ${tradesDelMes.length} trades de ${mesActual} importados`,
    //                 showConfirmButton: false, timer: 2000,
    //                 background: '#030712', color: 'gray'
    //             });
    //         } else {
    //             Swal.fire({
    //                 position: 'top-end', icon: 'info',
    //                 text: `No hay trades cerrados en ${mesActual}`,
    //                 showConfirmButton: false, timer: 1500,
    //                 background: '#030712', color: 'gray'
    //             });
    //         }

    //         await supabase
    //             .from('trading_journal')
    //             .update({ bybit_last_sync: new Date().toISOString() })
    //             .eq('auth_user_id', userId);

    //     } catch (error) {
    //         console.error('Error al sincronizar con Bybit:', error);
    //         Swal.fire({
    //             position: 'top-end', icon: 'error',
    //             text: `Error: ${error.message}`,
    //             showConfirmButton: false, timer: 2000,
    //             background: '#030712', color: 'gray'
    //         });
    //     } finally {
    //         setIsBybitSyncing(false);
    //     }
    // };

    //     const userId = overrideUserId || user?.id;
    //     if (!userId) return;
    //     if (isBybitSyncing) return;

    //     try {
    //         setIsBybitSyncing(true);

    //         const { data: journal } = await supabase
    //             .from('trading_journal')
    //             .select('bybit_api_key, bybit_api_secret')
    //             .eq('auth_user_id', userId)
    //             .single();

    //         if (!journal?.bybit_api_key) {
    //             throw new Error('No hay credenciales de Bybit guardadas');
    //         }

    //         const key = journal.bybit_api_key;
    //         const secret = journal.bybit_api_secret;
    //         const timestamp = Date.now().toString();
    //         const recvWindow = '5000';
    //         const queryParams = `category=linear&limit=200&settleCoin=USDT`;
    //         const signStr = `${timestamp}${key}${recvWindow}${queryParams}`;

    //         const encoder = new TextEncoder();
    //         const cryptoKey = await window.crypto.subtle.importKey(
    //             'raw', encoder.encode(secret),
    //             { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    //         );
    //         const signBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signStr));
    //         const signature = Array.from(new Uint8Array(signBuffer))
    //             .map(b => b.toString(16).padStart(2, '0')).join('');

    //         const response = await fetch(
    //             `https://api.bybit.com/v5/position/closed-pnl?${queryParams}`,
    //             {
    //                 headers: {
    //                     'X-BAPI-API-KEY': key,
    //                     'X-BAPI-TIMESTAMP': timestamp,
    //                     'X-BAPI-RECV-WINDOW': recvWindow,
    //                     'X-BAPI-SIGN': signature,
    //                 }
    //             }
    //         );

    //         const bybitData = await response.json();

    //         if (bybitData.retCode !== 0) {
    //             throw new Error(`Bybit error: ${bybitData.retMsg}`);
    //         }

    //         const now = new Date();
    //         const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    //         // Mapear TODOS los trades
    //         const allMapped = (bybitData.result?.list || [])
    //             .map(t => ({
    //                 id: t.orderId,
    //                 pair: t.symbol,
    //                 action: t.side === 'Sell' ? 'Short 🔴' : 'Long 🟢',
    //                 leverage: parseInt(t.leverage) || 1,
    //                 result: parseFloat(t.closedPnl) >= 0 ? 'win' : 'loss',
    //                 amount: Math.abs(parseFloat(t.closedPnl || '0')),
    //                 date: new Date(parseInt(t.createdTime)).toISOString().split('T')[0],
    //                 fromBybit: true,
    //                 pnl: parseFloat(t.closedPnl || '0'),
    //                 entryPrice: parseFloat(t.avgEntryPrice || '0'),
    //                 exitPrice: parseFloat(t.avgExitPrice || '0'),
    //             }))
    //             .filter(t => t.amount > 0);

    //         // Guardar TODOS para el calendario
    //         setAllTrades(allMapped);

    //         // Solo mes actual para estadísticas
    //         const tradesDelMes = allMapped.filter(t => t.date.startsWith(mesActual));

    //         // Cierre automático si cambió el mes
    //         const storedMonth = currentMonth || mesActual;
    //         if (storedMonth !== mesActual && trades.length > 0) {
    //             const monthName = new Date(storedMonth + '-01').toLocaleDateString('es-ES', {
    //                 year: 'numeric', month: 'long'
    //             });

    //             const statsDelMesAnterior = calculateStats(trades, initialCapital);
    //             const monthData = {
    //                 id: Date.now(),
    //                 month: storedMonth,
    //                 monthName,
    //                 initialCapital,
    //                 trades: [...trades],
    //                 stats: statsDelMesAnterior,
    //                 savedDate: new Date().toISOString()
    //             };

    //             setMonthlyHistory(prev => [monthData, ...prev]);
    //             setCurrentMonth(mesActual);
    //             setInitialCapital(0);
    //             setTrades(tradesDelMes);

    //             Swal.fire({
    //                 position: 'top-end', icon: 'success',
    //                 text: `📅 Mes ${monthName} cerrado automáticamente. Actualiza tu capital inicial.`,
    //                 showConfirmButton: false, timer: 3000,
    //                 background: '#030712', color: 'gray'
    //             });
    //         } else {
    //             setCurrentMonth(mesActual);
    //             setTrades(tradesDelMes);
    //         }

    //         setBybitLastSync(new Date());

    //         if (tradesDelMes.length > 0) {
    //             Swal.fire({
    //                 position: 'top-end', icon: 'success',
    //                 text: `🔄 ${tradesDelMes.length} trades de ${mesActual} importados`,
    //                 showConfirmButton: false, timer: 2000,
    //                 background: '#030712', color: 'gray'
    //             });
    //         } else {
    //             Swal.fire({
    //                 position: 'top-end', icon: 'info',
    //                 text: `No hay trades cerrados en ${mesActual}`,
    //                 showConfirmButton: false, timer: 1500,
    //                 background: '#030712', color: 'gray'
    //             });
    //         }

    //         await supabase
    //             .from('trading_journal')
    //             .update({ bybit_last_sync: new Date().toISOString() })
    //             .eq('auth_user_id', userId);

    //     } catch (error) {
    //         console.error('Error al sincronizar con Bybit:', error);
    //         Swal.fire({
    //             position: 'top-end', icon: 'error',
    //             text: `Error: ${error.message}`,
    //             showConfirmButton: false, timer: 2000,
    //             background: '#030712', color: 'gray'
    //         });
    //     } finally {
    //         setIsBybitSyncing(false);
    //     }
    // };

    // const syncWithBybit = async (overrideUserId = null) => {
    //     const userId = overrideUserId || user?.id;
    //     if (!userId) return;
    //     if (isBybitSyncing) return;

    //     try {
    //         setIsBybitSyncing(true);

    //         const { data: journal } = await supabase
    //             .from('trading_journal')
    //             .select('bybit_api_key, bybit_api_secret')
    //             .eq('auth_user_id', userId)
    //             .single();

    //         if (!journal?.bybit_api_key) {
    //             throw new Error('No hay credenciales de Bybit guardadas');
    //         }

    //         const key = journal.bybit_api_key;
    //         const secret = journal.bybit_api_secret;
    //         const timestamp = Date.now().toString();
    //         const recvWindow = '5000';
    //         const queryParams = `category=linear&limit=50&settleCoin=USDT`;
    //         const signStr = `${timestamp}${key}${recvWindow}${queryParams}`;

    //         const encoder = new TextEncoder();
    //         const cryptoKey = await window.crypto.subtle.importKey(
    //             'raw', encoder.encode(secret),
    //             { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    //         );
    //         const signBuffer = await window.crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(signStr));
    //         const signature = Array.from(new Uint8Array(signBuffer))
    //             .map(b => b.toString(16).padStart(2, '0')).join('');

    //         const response = await fetch(
    //             `https://api.bybit.com/v5/position/closed-pnl?${queryParams}`,
    //             {
    //                 headers: {
    //                     'X-BAPI-API-KEY': key,
    //                     'X-BAPI-TIMESTAMP': timestamp,
    //                     'X-BAPI-RECV-WINDOW': recvWindow,
    //                     'X-BAPI-SIGN': signature,
    //                 }
    //             }
    //         );

    //         const bybitData = await response.json();

    //         if (bybitData.retCode !== 0) {
    //             throw new Error(`Bybit error: ${bybitData.retMsg}`);
    //         }

    //         // Mes actual
    //         const now = new Date();


    //         const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;



    //         const allMapped = (bybitData.result?.list || [])
    //             .map(t => ({
    //                 id: t.orderId,
    //                 pair: t.symbol,
    //                 action: t.side === 'Sell' ? 'Short 🔴' : 'Long 🟢',
    //                 leverage: parseInt(t.leverage) || 1,
    //                 result: parseFloat(t.closedPnl) >= 0 ? 'win' : 'loss',
    //                 amount: Math.abs(parseFloat(t.closedPnl || '0')),
    //                 date: new Date(parseInt(t.createdTime)).toISOString().split('T')[0],
    //                 fromBybit: true,
    //                 pnl: parseFloat(t.closedPnl || '0'),
    //                 entryPrice: parseFloat(t.avgEntryPrice || '0'),
    //                 exitPrice: parseFloat(t.avgExitPrice || '0'),
    //             }))
    //             .filter(t => {
    //                 console.log('Trade date:', t.date, 'mesActual:', mesActual, 'match:', t.date.startsWith(mesActual));
    //                 return t.amount > 0 && t.date.startsWith(mesActual);
    //             });

    //         // Guardar TODOS para el calendario
    //         setAllTrades(allMapped);
    //         // Solo mes actual para estadísticas


    //         // Solo mes actual para estadísticas
    //         const tradesDelMes = allMapped.filter(t => t.date.startsWith(mesActual));






    //         // ── Cierre automático de mes anterior ──────────────────────────────
    //         const storedMonth = currentMonth || mesActual;
    //         if (storedMonth !== mesActual) {
    //             // El mes cambió — guardar el mes anterior automáticamente
    //             const monthName = new Date(currentMonth + '-01').toLocaleDateString('es-ES', {
    //                 year: 'numeric', month: 'long'
    //             });

    //             const statsDelMesAnterior = calculateStats(trades, initialCapital);

    //             const monthData = {
    //                 id: Date.now(),
    //                 month: currentMonth,
    //                 monthName,
    //                 initialCapital,
    //                 trades: [...trades],
    //                 stats: statsDelMesAnterior,
    //                 savedDate: new Date().toISOString()
    //             };

    //             const newHistory = [monthData, ...monthlyHistory];
    //             setMonthlyHistory(newHistory);
    //             setCurrentMonth(mesActual);
    //             setInitialCapital(0); // Reset para que el usuario lo edite
    //             setTrades(tradesDelMes);

    //             Swal.fire({
    //                 position: 'top-end', icon: 'success',
    //                 text: `📅 Mes ${monthName} cerrado automáticamente. Actualiza tu capital inicial.`,
    //                 showConfirmButton: false, timer: 3000,
    //                 background: '#030712', color: 'gray'
    //             });
    //         } else {
    //             // Solo mostrar trades del mes actual
    //             const soloMesActual = tradesDelMes.filter(t => t.date.startsWith(mesActual));
    //             setTrades(soloMesActual);
    //         }

    //         setCurrentMonth(mesActual);
    //         setBybitLastSync(new Date());

    //         if (tradesDelMes.length > 0) {
    //             Swal.fire({
    //                 position: 'top-end', icon: 'success',
    //                 text: `🔄 ${tradesDelMes.length} trades de ${mesActual} importados`,
    //                 showConfirmButton: false, timer: 2000,
    //                 background: '#030712', color: 'gray'
    //             });
    //         } else {
    //             Swal.fire({
    //                 position: 'top-end', icon: 'info',
    //                 text: `No hay trades cerrados en ${mesActual}`,
    //                 showConfirmButton: false, timer: 1500,
    //                 background: '#030712', color: 'gray'
    //             });
    //         }

    //         await supabase
    //             .from('trading_journal')
    //             .update({ bybit_last_sync: new Date().toISOString() })
    //             .eq('auth_user_id', userId);

    //     } catch (error) {
    //         console.error('Error al sincronizar con Bybit:', error);
    //         Swal.fire({
    //             position: 'top-end', icon: 'error',
    //             text: `Error: ${error.message}`,
    //             showConfirmButton: false, timer: 2000,
    //             background: '#030712', color: 'gray'
    //         });
    //     } finally {
    //         setIsBybitSyncing(false);
    //     }
    // };

    // ─── Desconectar Bybit ───────────────────────────────────────────────────────
    const disconnectBybit = async () => {
        const result = await Swal.fire({
            text: '¿Desconectar Bybit? Los trades actuales se conservarán.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#374151',
            confirmButtonText: 'Sí, desconectar',
            background: '#030712', color: 'gray'
        });

        if (result.isConfirmed) {
            await supabase
                .from('trading_journal')
                .update({ bybit_connected: false, bybit_api_key: null, bybit_api_secret: null })
                .eq('auth_user_id', user.id);
            setBybitConnected(false);
        }
    };

    // ─── Estadísticas ────────────────────────────────────────────────────────────
    const calculateStats = (tradesList, initialCap) => {
        let currentBalance = initialCap;
        let totalWins = 0, totalLosses = 0;
        let winAmount = 0, lossAmount = 0;
        let maxDrawdown = 0, peak = initialCap;

        const balanceHistory = [{ date: 'Inicio', balance: initialCap }];

        tradesList.forEach((trade, index) => {
            const amount = parseFloat(trade.amount) || 0;
            if (trade.result === 'win') {
                currentBalance += amount; totalWins++; winAmount += amount;
            } else {
                currentBalance -= amount; totalLosses++; lossAmount += amount;
            }
            if (currentBalance > peak) peak = currentBalance;
            const drawdown = ((peak - currentBalance) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;
            balanceHistory.push({ date: `Op ${index + 1}`, balance: parseFloat(currentBalance.toFixed(2)) });
        });

        const totalTrades = tradesList.length;
        const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
        const profitLoss = currentBalance - initialCap;
        const roi = initialCap > 0 ? (profitLoss / initialCap) * 100 : 0;

        return {
            currentBalance, totalWins, totalLosses, totalTrades,
            winRate, profitLoss, roi, winAmount, lossAmount,
            maxDrawdown, balanceHistory, totalProfit: winAmount - lossAmount
        };
    };

    const stats = calculateStats(trades, initialCapital);

    // ─── CRUD trades ─────────────────────────────────────────────────────────────
    const addTrade = () => {
        if (!newTrade.pair || newTrade.amount <= 0) {
            Swal.fire({
                position: 'top-end', icon: 'info',
                text: 'Por favor completa todos los campos correctamente',
                showConfirmButton: false, timer: 1500,
                background: '#030712', color: 'gray'
            });
            return;
        }
        setTrades([...trades, { ...newTrade, id: Date.now() }]);
        setNewTrade({
            pair: '', action: 'Long 🟢', leverage: 1,
            result: 'win', amount: 0,
            date: new Date().toISOString().split('T')[0]
        });
    };

    const deleteTrade = (id) => setTrades(trades.filter(t => t.id !== id));

    const saveCurrentMonth = () => {
        if (trades.length === 0) {
            Swal.fire({
                position: 'top-end', icon: 'info',
                text: 'No hay operaciones para guardar',
                showConfirmButton: false, timer: 1500,
                background: '#030712', color: 'gray'
            });
            return;
        }

        const monthName = new Date(currentMonth + '-01').toLocaleDateString('es-ES', {
            year: 'numeric', month: 'long'
        });

        const monthData = {
            id: Date.now(), month: currentMonth, monthName,
            initialCapital, trades: [...trades], stats,
            savedDate: new Date().toISOString()
        };

        setMonthlyHistory([monthData, ...monthlyHistory]);
        setInitialCapital(stats.currentBalance);
        setTrades([]);
        setCurrentMonth(new Date().toISOString().slice(0, 7));

        Swal.fire({
            position: 'top-end', icon: 'success',
            text: `✅ Mes guardado: ${monthName}`,
            showConfirmButton: false, timer: 1500,
            background: '#030712', color: 'gray'
        });
    };

    const deleteMonth = (id) => {
        Swal.fire({
            text: '¿Estás seguro de eliminar este mes?',
            icon: 'warning', showCancelButton: true,
            confirmButtonColor: '#3085d6', cancelButtonColor: '#d33',
            confirmButtonText: 'Sí, eliminar',
            background: '#030712', color: 'gray'
        }).then((result) => {
            if (result.isConfirmed) {
                setMonthlyHistory(monthlyHistory.filter(m => m.id !== id));
                Swal.fire({
                    title: 'Eliminado', text: 'El mes ha sido eliminado',
                    icon: 'success', background: '#030712', color: 'gray'
                });
            }
        });
    };

    const exportData = () => {
        const data = { initialCapital, trades, monthlyHistory, currentMonth, exportDate: new Date().toISOString() };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                setInitialCapital(data.initialCapital || 1000);
                setTrades(data.trades || []);
                setMonthlyHistory(data.monthlyHistory || []);
                setCurrentMonth(data.currentMonth || new Date().toISOString().slice(0, 7));
                Swal.fire({
                    position: 'top-end', icon: 'success',
                    text: 'Datos importados exitosamente',
                    showConfirmButton: false, timer: 1500,
                    background: '#030712', color: 'gray'
                });
            } catch {
                Swal.fire({
                    position: 'top-end', icon: 'error',
                    text: 'Error al importar el archivo',
                    showConfirmButton: false, timer: 1500,
                    background: '#030712', color: 'gray'
                });
            }
        };
        reader.readAsText(file);
    };

    // ─── Chart data ──────────────────────────────────────────────────────────────
    const currentStats = view === 'monthDetail' ? selectedMonth?.stats : stats;
    const resultData = [
        { name: 'Ganadas', value: currentStats?.totalWins || 0, color: '#10b981' },
        { name: 'Perdidas', value: currentStats?.totalLosses || 0, color: '#ef4444' }
    ];
    const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    // ─── Indicators ──────────────────────────────────────────────────────────────
    const SyncIndicator = () => (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${isSyncing ? 'bg-orange-900/100' : 'bg-green-900/100'}`}>
            <Cloud className="w-4 h-4" />
            <span className="text-white">
                {isSyncing ? 'Sincronizando...' : lastSync ? `Sync ${lastSync.toLocaleTimeString()}` : 'Sincronizado'}
            </span>
        </div>
    );

    const BybitIndicator = () => (
        <div
            onClick={bybitConnected ? syncWithBybit : () => setShowBybitConfig(true)}
            className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm cursor-pointer transition-all ${bybitConnected
                ? 'bg-cyan-900/50 border border-cyan-500/30 hover:bg-cyan-900/80'
                : 'bg-gray-800 border border-gray-700 hover:bg-gray-700'
                }`}
        >
            {isBybitSyncing ? (
                <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
            ) : (
                <Zap className={`w-4 h-4 ${bybitConnected ? 'text-cyan-400' : 'text-gray-400'}`} />
            )}
            <span className={bybitConnected ? 'text-cyan-300' : 'text-gray-400'}>
                {isBybitSyncing
                    ? 'Importando...'
                    : bybitConnected
                        ? bybitLastSync ? `Bybit · ${bybitLastSync.toLocaleTimeString()}` : 'Bybit conectado'
                        : 'Conectar Bybit'}
            </span>
        </div>
    );

    // ─── Modal Bybit Config ──────────────────────────────────────────────────────
    const BybitConfigModal = () => (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        Conectar Bybit
                    </h2>
                    <button onClick={() => setShowBybitConfig(false)} className="text-gray-400 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-3 mb-4 text-sm text-cyan-300">
                    🔒 Tus credenciales se guardan encriptadas en tu base de datos personal. Usa solo permisos <strong>Read-Only</strong>.
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-gray-400 text-sm mb-2 block">API Key</label>
                        <input
                            type="text"
                            placeholder="Tu API Key de Bybit"
                            value={bybitForm.apiKey}
                            onChange={(e) => setBybitForm({ ...bybitForm, apiKey: e.target.value })}
                            className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none font-mono text-sm"
                        />
                    </div>

                    <div>
                        <label className="text-gray-400 text-sm mb-2 block">API Secret</label>
                        <div className="relative">
                            <input
                                type={showApiSecret ? 'text' : 'password'}
                                placeholder="Tu API Secret de Bybit"
                                value={bybitForm.apiSecret}
                                onChange={(e) => setBybitForm({ ...bybitForm, apiSecret: e.target.value })}
                                className="w-full bg-gray-800 text-white px-4 py-2 pr-10 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none font-mono text-sm"
                            />
                            <button
                                onClick={() => setShowApiSecret(!showApiSecret)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                            >
                                {showApiSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button
                        onClick={() => setShowBybitConfig(false)}
                        className="flex-1 bg-gray-800 text-gray-300 py-2 rounded-lg hover:bg-gray-700 transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={saveBybitCredentials}
                        className="flex-1 bg-cyan-600 text-white py-2 rounded-lg hover:bg-cyan-700 transition-all font-bold"
                    >
                        Conectar y Sincronizar
                    </button>
                </div>

                {bybitConnected && (
                    <button
                        onClick={disconnectBybit}
                        className="w-full mt-3 text-red-400 text-sm hover:text-red-300 transition-colors"
                    >
                        Desconectar Bybit
                    </button>
                )}
            </div>
        </div>
    );

    // ─── Modal Detalle de Trade ──────────────────────────────────────────────────
    const TradeDetailModal = ({ trade, onClose }) => {
        const isWin = trade.result === 'win';
        const capitalOperado = trade.entryPrice && trade.qty && trade.leverage
            ? (trade.entryPrice * trade.qty) / trade.leverage
            : trade.cumExitValue || 0;
        const roi = capitalOperado > 0 ? (trade.pnl / capitalOperado) * 100 : 0;

        const formatDateTime = (iso) => {
            if (!iso) return '—';
            return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        };

        const stats = [
            { label: 'Broker', value: trade.fromBybit ? 'Bybit' : 'Manual', color: 'text-white' },
            { label: 'Dirección', value: trade.action.includes('Long') ? 'LONG' : 'SHORT', color: trade.action.includes('Long') ? 'text-green-400' : 'text-red-400' },
            { label: 'Cantidad negociada', value: trade.qty ? trade.qty.toLocaleString() : '—', color: 'text-white' },
            { label: 'Apalancamiento', value: `${trade.leverage}x`, color: 'text-yellow-400' },
            { label: 'ROI Neto', value: capitalOperado > 0 ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : '—', color: roi >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'P&L Bruto', value: `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(4)}`, color: trade.pnl >= 0 ? 'text-green-400' : 'text-red-400' },
            { label: 'Precio Entrada', value: trade.entryPrice ? `$${trade.entryPrice.toFixed(4)}` : '—', color: 'text-cyan-400' },
            { label: 'Precio Salida', value: trade.exitPrice ? `$${trade.exitPrice.toFixed(4)}` : '—', color: 'text-cyan-400' },
            { label: 'Capital Operado', value: capitalOperado > 0 ? `USDT ${capitalOperado.toFixed(2)}` : '—', color: 'text-white' },
        ];

        return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div
                    className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-5xl shadow-2xl overflow-hidden"
                    style={{ maxHeight: '90vh', overflowY: 'auto' }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl font-bold text-white">{trade.pair}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${isWin ? 'bg-green-900/40 text-green-400 border-green-500/30' : 'bg-red-900/40 text-red-400 border-red-500/30'}`}>
                                {isWin ? 'GANADOR' : 'PERDEDOR'}
                            </span>
                            <span className="text-sm text-gray-500">{trade.date}</span>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="grid grid-cols-1 lg:grid-cols-2">
                        {/* Left – Stats */}
                        <div className="p-6 border-b lg:border-b-0 lg:border-r border-gray-800">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4">Estadísticas del Trade</p>

                            <div className="mb-5">
                                <p className="text-xs text-gray-500 mb-1">P&L Neto</p>
                                <p className={`text-4xl font-bold ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                                    {isWin ? '+' : '-'}${Math.abs(trade.pnl).toFixed(2)}
                                </p>
                            </div>

                            <div className="space-y-1">
                                {stats.map(({ label, value, color }) => (
                                    <div key={label} className="flex items-center justify-between py-2.5 border-b border-gray-800/60">
                                        <span className="text-sm text-gray-400">{label}</span>
                                        <span className={`text-sm font-semibold ${color}`}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right – Chart */}
                        <div className="p-6 flex flex-col gap-4">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gráfico</p>

                            <TradeChart trade={trade} bybitCreds={bybitCreds} />

                            {(trade.entryTime || trade.exitTime) && (
                                <div className="flex flex-wrap gap-4 text-xs text-gray-400">
                                    <span>
                                        <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />
                                        Entrada: <span className="text-gray-300">{formatDateTime(trade.entryTime)}</span>
                                        {trade.entryPrice ? <span className="text-green-400 ml-1">@ ${trade.entryPrice.toFixed(4)}</span> : ''}
                                    </span>
                                    <span>
                                        <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />
                                        Salida: <span className="text-gray-300">{formatDateTime(trade.exitTime)}</span>
                                        {trade.exitPrice ? <span className="text-red-400 ml-1">@ ${trade.exitPrice.toFixed(4)}</span> : ''}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ════════════════════════════════════════════════════════════════════════════
    // VISTA: Historial Mensual
    // ════════════════════════════════════════════════════════════════════════════
    if (view === 'history') {
        return (
            <div className="min-h-screen bg-gray-950 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 mb-6 border border-gray-800">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button onClick={() => setView('current')} className="bg-white text-gray-600 p-2 rounded-lg hover:bg-purple-50 transition-all">
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                                <div>
                                    <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                                        <Archive className="w-10 h-10" /> Historial Mensual
                                    </h1>
                                    <p className="text-purple-100">Todos tus meses guardados</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {monthlyHistory.length === 0 ? (
                        <div className="bg-slate-800 rounded-xl p-12 text-center border border-slate-700">
                            <Archive className="w-20 h-20 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-slate-400 mb-2">No hay meses guardados</h3>
                            <p className="text-slate-500">Guarda tu primer mes desde la vista actual</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {monthlyHistory.map((monthData) => (
                                <div
                                    key={monthData.id}
                                    className="bg-slate-800 rounded-xl p-6 border border-slate-700 hover:border-cyan-500 transition-all cursor-pointer"
                                    onClick={() => { setSelectedMonth(monthData); setView('monthDetail'); }}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-blue-400 capitalize">{monthData.monthName}</h3>
                                        <button onClick={(e) => { e.stopPropagation(); deleteMonth(monthData.id); }} className="text-red-400 hover:text-red-300">
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <div className="space-y-3">
                                        {[
                                            ['Balance Final', `$${monthData.stats.currentBalance.toFixed(2)}`, 'text-white'],
                                            ['P/L', `${monthData.stats.profitLoss >= 0 ? '+' : ''}$${monthData.stats.profitLoss.toFixed(2)}`, monthData.stats.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'],
                                            ['ROI', `${monthData.stats.roi.toFixed(2)}%`, monthData.stats.roi >= 0 ? 'text-blue-400' : 'text-red-400'],
                                            ['Operaciones', monthData.stats.totalTrades, 'text-white'],
                                            ['Win Rate', `${monthData.stats.winRate.toFixed(1)}%`, 'text-purple-400'],
                                        ].map(([label, value, color]) => (
                                            <div key={label} className="flex justify-between items-center">
                                                <span className="text-slate-400">{label}</span>
                                                <span className={`font-bold ${color}`}>{value}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between text-slate-500 text-xs">
                                        <span>Ver detalles</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // VISTA: Detalle de Mes
    // ════════════════════════════════════════════════════════════════════════════
    if (view === 'monthDetail' && selectedMonth) {
        return (
            <div className="min-h-screen bg-gray-950 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 mb-6 border border-gray-800">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView('history')} className="bg-white text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-all">
                                <ArrowLeft className="w-6 h-6" />
                            </button>
                            <div>
                                <h1 className="text-4xl font-bold text-white capitalize">{selectedMonth.monthName}</h1>
                                <p className="text-purple-100">Detalles completos del mes</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        {[
                            { icon: <DollarSign className="w-10 h-10 text-white" />, label: 'Balance Final', value: `$${selectedMonth.stats.currentBalance.toFixed(2)}`, sub: `Inicial: $${selectedMonth.initialCapital.toFixed(2)}`, bg: selectedMonth.stats.profitLoss >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30' },
                            { icon: <TrendingUp className="w-10 h-10 text-white" />, label: 'ROI', value: `${selectedMonth.stats.roi.toFixed(2)}%`, sub: `${selectedMonth.stats.profitLoss >= 0 ? '+' : ''}${selectedMonth.stats.profitLoss.toFixed(2)} USDT`, bg: 'bg-blue-900/20 border-blue-500/30' },
                            { icon: <PieChart className="w-10 h-10 text-white" />, label: 'Win Rate', value: `${selectedMonth.stats.winRate.toFixed(1)}%`, sub: `${selectedMonth.stats.totalWins}W / ${selectedMonth.stats.totalLosses}L`, bg: 'bg-purple-900/20 border-purple-500/30' },
                            { icon: <BarChart3 className="w-10 h-10 text-white" />, label: 'Total Trades', value: selectedMonth.stats.totalTrades, sub: 'Operaciones del mes', bg: 'bg-amber-900/20 border-amber-500/30' },
                        ].map(({ icon, label, value, sub, bg }) => (
                            <div key={label} className={`rounded-xl p-6 shadow-lg border ${bg}`}>
                                <div className="flex items-center justify-between mb-2">{icon}<span className="text-white text-sm font-semibold">{label}</span></div>
                                <p className="text-3xl font-bold text-white">{value}</p>
                                <p className="text-sm mt-1 text-gray-300">{sub}</p>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                            <h3 className="text-xl font-bold text-cyan-400 mb-4">📈 Evolución del Balance</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={selectedMonth.stats.balanceHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="date" stroke="#9ca3af" />
                                    <YAxis stroke="#9ca3af" />
                                    <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#9ca3af' }} />
                                    <Line type="monotone" dataKey="balance" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                            <h3 className="text-xl font-bold text-cyan-400 mb-4">🎯 Distribución de Resultados</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <RePieChart>
                                    <Pie data={resultData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                                        {resultData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-xl p-6 mb-6 border border-slate-700">
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">📊 Estadísticas Detalladas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-slate-700 p-4 rounded-lg"><p className="text-slate-400 text-sm">💰 Total Ganancias</p><p className="text-2xl font-bold text-green-400">+${selectedMonth.stats.winAmount.toFixed(2)}</p></div>
                            <div className="bg-slate-700 p-4 rounded-lg"><p className="text-slate-400 text-sm">💵 Profit Neto</p><p className={`text-2xl font-bold ${selectedMonth.stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{selectedMonth.stats.totalProfit >= 0 ? '+' : '-'}${Math.abs(selectedMonth.stats.totalProfit).toFixed(2)}</p></div>
                            <div className="bg-slate-700 p-4 rounded-lg"><p className="text-slate-400 text-sm">💸 Total Pérdidas</p><p className="text-2xl font-bold text-red-400">-${selectedMonth.stats.lossAmount.toFixed(2)}</p></div>
                            <div className="bg-slate-700 p-4 rounded-lg"><p className="text-slate-400 text-sm">📉 Max Drawdown</p><p className="text-2xl font-bold text-orange-400">{selectedMonth.stats.maxDrawdown.toFixed(2)}%</p></div>
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                        <div className="p-6 border-b border-slate-700">
                            <h2 className="text-xl font-bold text-cyan-400">📋 Operaciones del Mes</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-700">
                                    <tr>
                                        {['Fecha', 'Par', 'Tipo', 'Apalancamiento', 'Resultado', 'Monto'].map(h => (
                                            <th key={h} className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {[...selectedMonth.trades].reverse().map((trade) => (
                                        <tr key={trade.id} className="hover:bg-slate-700 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-300">{trade.date}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-white">
                                                {trade.pair}
                                                {trade.fromBybit && <span className="ml-2 text-xs text-cyan-400 bg-cyan-900/30 px-1.5 py-0.5 rounded">Bybit</span>}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-semibold text-white">{trade.action}</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{trade.leverage}x</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${trade.result === 'win' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                    {trade.result === 'win' ? '✅ Ganada' : '❌ Perdida'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold">
                                                <span className={trade.result === 'win' ? 'text-green-400' : 'text-red-400'}>
                                                    {trade.result === 'win' ? '+' : '-'}${parseFloat(trade.amount).toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ════════════════════════════════════════════════════════════════════════════
    // VISTA PRINCIPAL
    // ════════════════════════════════════════════════════════════════════════════
    return (
        <>
        <div className="min-h-screen bg-gray-950 p-4 md:p-8">
            {showBybitConfig && <BybitConfigModal />}

            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 mb-6 border border-gray-800">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                                <BarChart3 className="w-10 h-10 text-cyan-400" />
                                Bitácora de Trading Pro
                            </h1>
                            <p className="text-gray-400">Mes actual en progreso</p>
                        </div>
                        <div className="flex flex-col gap-2">
                            <div className="flex gap-2 flex-wrap justify-end">
                                <SyncIndicator />
                                <BybitIndicator />
                            </div>
                            <div className="flex gap-2 flex-wrap justify-end">
                                <button onClick={() => setView('history')} className="bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all border border-gray-700">
                                    <Archive className="w-4 h-4" /> Historial
                                </button>
                                <button onClick={saveCurrentMonth} className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all">
                                    <Save className="w-4 h-4" /> Guardar Mes
                                </button>
                                <button onClick={exportData} className="bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all border border-gray-700">
                                    <Download className="w-4 h-4" /> Exportar
                                </button>
                                <label className="bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all border border-gray-700 cursor-pointer">
                                    <Upload className="w-4 h-4" /> Importar
                                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Banner Bybit si no está conectado */}
                {!bybitConnected && (
                    <div
                        onClick={() => setShowBybitConfig(true)}
                        className="bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-cyan-500/30 rounded-xl p-4 mb-6 flex items-center justify-between cursor-pointer hover:from-cyan-900/50 hover:to-blue-900/50 transition-all"
                    >
                        <div className="flex items-center gap-3">
                            <Zap className="w-6 h-6 text-cyan-400" />
                            <div>
                                <p className="text-white font-semibold">Conecta tu cuenta de Bybit</p>
                                <p className="text-cyan-300 text-sm">Importa tus trades automáticamente cada vez que abras la app</p>
                            </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-cyan-400" />
                    </div>
                )}

                {/* Capital Inicial */}
                <div className="bg-gray-900 rounded-xl shadow-xl p-6 mb-6 border border-gray-800">
                    <label className="text-gray-400 text-sm font-semibold mb-3 block">💰 Capital Inicial (USDT)</label>
                    <input
                        type="number"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                        className="w-full bg-gray-800 text-white px-4 py-3 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none text-lg font-bold"
                        step="0.01"
                    />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                        { icon: <DollarSign className="w-10 h-10 text-white" />, label: 'Balance Actual', value: `$${stats.currentBalance.toFixed(2)}`, sub: `${stats.profitLoss >= 0 ? '+' : ''}${stats.profitLoss.toFixed(2)} USDT`, bg: stats.profitLoss >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30', subColor: stats.profitLoss >= 0 ? 'text-green-400' : 'text-red-400' },
                        { icon: <TrendingUp className="w-10 h-10 text-white" />, label: 'ROI', value: `${stats.roi.toFixed(2)}%`, sub: 'Retorno de inversión', bg: 'bg-blue-900/20 border-blue-500/30', subColor: 'text-blue-400' },
                        { icon: <PieChart className="w-10 h-10 text-white" />, label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, sub: `${stats.totalWins}W / ${stats.totalLosses}L`, bg: 'bg-purple-900/20 border-purple-500/30', subColor: 'text-purple-400' },
                        { icon: <BarChart3 className="w-10 h-10 text-white" />, label: 'Total Trades', value: stats.totalTrades, sub: 'Operaciones registradas', bg: 'bg-amber-900/20 border-amber-500/30', subColor: 'text-amber-400' },
                    ].map(({ icon, label, value, sub, bg, subColor }) => (
                        <div key={label} className={`rounded-xl p-6 shadow-lg border ${bg}`}>
                            <div className="flex items-center justify-between mb-2">{icon}<span className="text-gray-400 text-sm font-semibold">{label}</span></div>
                            <p className="text-3xl font-bold text-white">{value}</p>
                            <p className={`text-sm mt-1 ${subColor}`}>{sub}</p>
                        </div>
                    ))}
                </div>

                {/* Formulario Nueva Operación — solo si NO está conectado a Bybit */}
                {!bybitConnected && (
                    <div className="bg-gray-900 rounded-xl shadow-xl p-6 mb-6 border border-gray-800">
                        <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                            <Plus className="w-6 h-6" /> Nueva Operación Manual
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            {[
                                { label: '📊 Par', type: 'text', placeholder: 'BTC/USDT', value: newTrade.pair, onChange: (v) => setNewTrade({ ...newTrade, pair: v.toUpperCase() }) },
                            ].map(({ label, type, placeholder, value, onChange }) => (
                                <div key={label}>
                                    <label className="text-gray-400 text-sm mb-2 block">{label}</label>
                                    <input type={type} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)}
                                        className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none" />
                                </div>
                            ))}
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">Tipo ⬆️⬇️</label>
                                <select value={newTrade.action} onChange={(e) => setNewTrade({ ...newTrade, action: e.target.value })}
                                    className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none">
                                    <option value="Long 🟢">🟢 Long</option>
                                    <option value="Short 🔴">🔴 Short</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">⚡ Apalancamiento</label>
                                <input type="number" value={newTrade.leverage} onChange={(e) => setNewTrade({ ...newTrade, leverage: parseInt(e.target.value) || 1 })} min="1" max="125"
                                    className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">📈 Resultado</label>
                                <select value={newTrade.result} onChange={(e) => setNewTrade({ ...newTrade, result: e.target.value })}
                                    className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none">
                                    <option value="win">✅ Ganada</option>
                                    <option value="loss">❌ Perdida</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">💵 Monto (USDT)</label>
                                <input type="number" value={newTrade.amount} onChange={(e) => setNewTrade({ ...newTrade, amount: parseFloat(e.target.value) || 0 })} step="0.01"
                                    className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none" />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">📅 Fecha</label>
                                <input type="date" value={newTrade.date} onChange={(e) => setNewTrade({ ...newTrade, date: e.target.value })}
                                    className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none" />
                            </div>
                        </div>
                        <button onClick={addTrade} className="mt-4 w-full bg-cyan-600 text-white px-6 py-3 rounded-lg hover:bg-cyan-700 transition-all font-bold flex items-center justify-center gap-2">
                            <Plus className="w-5 h-5" /> Agregar Operación
                        </button>
                    </div>
                )}

                {/* Si está conectado a Bybit, mostrar info de sincronización */}
                {bybitConnected && (
                    <div className="bg-gray-900 rounded-xl p-4 mb-6 border border-cyan-500/20 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-cyan-400" />
                            <div>
                                <p className="text-white text-sm font-semibold">Bybit conectado — Importación automática activa</p>
                                <p className="text-gray-400 text-xs">
                                    {bybitLastSync ? `Última sync: ${bybitLastSync.toLocaleString()}` : 'Sincronizando...'}
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => syncWithBybit()} disabled={isBybitSyncing}
                                className="bg-cyan-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-cyan-700 transition-all disabled:opacity-50">
                                <RefreshCw className={`w-3.5 h-3.5 ${isBybitSyncing ? 'animate-spin' : ''}`} />
                                {isBybitSyncing ? 'Sincronizando...' : 'Sincronizar'}
                            </button>
                            <button onClick={() => setShowBybitConfig(true)} className="bg-gray-800 text-gray-400 px-3 py-1.5 rounded-lg text-sm flex items-center gap-1 hover:bg-gray-700 transition-all border border-gray-700">
                                <Settings className="w-3.5 h-3.5" /> Config
                            </button>
                        </div>
                    </div>
                )}

                {/* Calendario */}
                {/* Calendario */}
                <div className="mb-6">
                    <TradeCalendar
                        trades={allTrades.length > 0 ? allTrades : trades}
                        currentMonth={currentMonth}
                    />
                </div>

                {/* Gráficas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">📈 Evolución del Balance</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={stats.balanceHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="date" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#9ca3af' }} />
                                <Line type="monotone" dataKey="balance" stroke="#06b6d4" strokeWidth={3} dot={{ fill: '#06b6d4' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">🎯 Distribución de Resultados</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <RePieChart>
                                <Pie data={resultData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} outerRadius={100} dataKey="value">
                                    {resultData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                                </Pie>
                                <Tooltip />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Estadísticas detalladas */}
                <div className="bg-gray-900 rounded-xl p-6 mb-6 border border-gray-800">
                    <h3 className="text-xl font-bold text-cyan-400 mb-4">📊 Estadísticas Detalladas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700"><p className="text-gray-400 text-sm">💰 Total Ganancias</p><p className="text-2xl font-bold text-green-400">+${stats.winAmount.toFixed(2)}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700"><p className="text-gray-400 text-sm">💵 Balance Neto</p><p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.totalProfit >= 0 ? '+' : '-'}${Math.abs(stats.totalProfit).toFixed(2)}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700"><p className="text-gray-400 text-sm">💸 Total Pérdidas</p><p className="text-2xl font-bold text-red-400">-${stats.lossAmount.toFixed(2)}</p></div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700"><p className="text-gray-400 text-sm">📉 Max Drawdown</p><p className="text-2xl font-bold text-orange-400">{stats.maxDrawdown.toFixed(2)}%</p></div>
                    </div>
                </div>

                {/* Tabla trades */}
                <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800">
                    <div className="p-6 bg-gray-800 border-b border-gray-700 flex items-center justify-between">
                        <h2 className="text-2xl font-bold text-cyan-400">📋 Historial de Operaciones</h2>
                        {bybitConnected && (
                            <span className="text-xs text-cyan-400 bg-cyan-900/30 px-2 py-1 rounded-full border border-cyan-500/30">
                                🔄 Importado desde Bybit
                            </span>
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    {['Fecha', 'Par', 'Tipo', 'Apalancamiento', 'Resultado', 'Monto'].map(h => (
                                        <th key={h} className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {trades.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-8 text-center text-gray-400">
                                            {bybitConnected ? '🔄 Sincronizando trades desde Bybit...' : 'No hay operaciones. ¡Agrega tu primera operación!'}
                                        </td>
                                    </tr>
                                ) : (
                                    [...trades].reverse().map((trade) => (
                                        <tr
                                            key={trade.id}
                                            className="hover:bg-gray-800 transition-colors cursor-pointer"
                                            onClick={() => setSelectedTrade(trade)}
                                        >
                                            <td className="px-3 py-4 text-sm text-gray-300">{trade.date}</td>
                                            <td className="px-3 py-4 text-sm font-semibold text-white">
                                                {trade.pair}
                                                {trade.fromBybit && <span className="ml-1 text-xs text-cyan-400 bg-cyan-900/30 px-1 py-0.5 rounded">Bybit</span>}
                                            </td>
                                            <td className="px-3 py-4 text-sm font-semibold text-white">{trade.action}</td>
                                            <td className="px-3 py-4 text-sm text-gray-300">{trade.leverage}x</td>
                                            <td className="px-3 py-4 text-sm">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${trade.result === 'win' ? 'bg-green-900/50 text-green-300 border border-green-500/30' : 'bg-red-900/50 text-red-300 border border-red-500/30'}`}>
                                                    {trade.result === 'win' ? '✅ Ganada' : '❌ Perdida'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 text-sm font-bold">
                                                <span className={trade.result === 'win' ? 'text-green-400' : 'text-red-400'}>
                                                    {trade.result === 'win' ? '+' : '-'}${parseFloat(trade.amount).toFixed(2)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {selectedTrade && (
            <TradeDetailModal trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
        )}
        </>
    );
};

export default TradingJournal;