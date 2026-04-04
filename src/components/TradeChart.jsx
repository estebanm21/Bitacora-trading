import { useEffect, useRef, useState } from 'react';
import { createChart, CandlestickSeries, createSeriesMarkers } from 'lightweight-charts';
import { supabase } from '../config/supabase';

const INTERVALS = [
    { label: '15m', value: '15' },
    { label: '1h',  value: '60' },
];

// Firma HMAC-SHA256 para llamadas autenticadas a Bybit
async function bybitAuthFetch(endpoint, queryStr, apiKey, apiSecret) {
    const ts         = Date.now().toString();
    const recvWindow = '5000';
    const signStr    = `${ts}${apiKey}${recvWindow}${queryStr}`;
    const enc        = new TextEncoder();
    const ck         = await window.crypto.subtle.importKey(
        'raw', enc.encode(apiSecret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sb  = await window.crypto.subtle.sign('HMAC', ck, enc.encode(signStr));
    const sig = Array.from(new Uint8Array(sb)).map(b => b.toString(16).padStart(2, '0')).join('');
    const res = await fetch(`https://api.bybit.com${endpoint}?${queryStr}`, {
        headers: {
            'X-BAPI-API-KEY':      apiKey,
            'X-BAPI-TIMESTAMP':    ts,
            'X-BAPI-RECV-WINDOW':  recvWindow,
            'X-BAPI-SIGN':         sig,
        }
    });
    return res.json();
}

export default function TradeChart({ trade, bybitCreds }) {
    const containerRef = useRef(null);
    const chartRef     = useRef(null);
    const seriesRef    = useRef(null);
    const [error, setError]       = useState(null);
    const [loading, setLoading]   = useState(true);
    const [interval, setInterval] = useState('15');

    useEffect(() => {
        if (!containerRef.current) return;

        setError(null);
        setLoading(true);

        if (chartRef.current) {
            chartRef.current.remove();
            chartRef.current  = null;
            seriesRef.current = null;
        }

        let cancelled = false;

        const raf = requestAnimationFrame(() => {
            if (!containerRef.current || cancelled) return;

            const chart = createChart(containerRef.current, {
                width:  containerRef.current.clientWidth  || 600,
                height: containerRef.current.clientHeight || 380,
                layout: {
                    background: { color: '#111827' },
                    textColor:  '#9ca3af',
                },
                grid: {
                    vertLines: { color: '#1f2937' },
                    horzLines: { color: '#1f2937' },
                },
                crosshair: { mode: 1 },
                rightPriceScale: { borderColor: '#374151' },
                timeScale: {
                    borderColor:    '#374151',
                    timeVisible:    true,
                    secondsVisible: false,
                },
            });

            chartRef.current  = chart;
            const series      = chart.addSeries(CandlestickSeries, {
                upColor:         '#10b981',
                downColor:       '#ef4444',
                borderUpColor:   '#10b981',
                borderDownColor: '#ef4444',
                wickUpColor:     '#10b981',
                wickDownColor:   '#ef4444',
            });
            seriesRef.current = series;

            // Resize responsivo
            const ro = new ResizeObserver(() => {
                if (containerRef.current && chartRef.current) {
                    chartRef.current.resize(
                        containerRef.current.clientWidth,
                        containerRef.current.clientHeight || 380
                    );
                }
            });
            ro.observe(containerRef.current);

            // Async: cargar velas y ejecuciones
            (async () => {
                try {
                    // ── Rango de tiempo ───────────────────────────────────────
                    const exitMs   = trade.exitTime  ? new Date(trade.exitTime).getTime()  : Date.now();
                    const entryMs  = trade.entryTime ? new Date(trade.entryTime).getTime() : exitMs - 7200000;
                    const duration = Math.max(exitMs - entryMs, 3600000);
                    const pad      = Math.max(duration, 7200000); // mínimo 2h padding

                    // ── Buscar tiempo real de apertura vía ejecuciones ────────
                    let actualEntryMs = entryMs;

                    try {
                        // Cargar credenciales directamente desde Supabase
                        let apiKey = bybitCreds?.apiKey;
                        let apiSecret = bybitCreds?.apiSecret;

                        if (!apiKey || !apiSecret) {
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session?.user) {
                                const { data: journal } = await supabase
                                    .from('trading_journal')
                                    .select('bybit_api_key, bybit_api_secret')
                                    .eq('auth_user_id', session.user.id)
                                    .single();
                                apiKey    = journal?.bybit_api_key;
                                apiSecret = journal?.bybit_api_secret;
                            }
                        }

                        if (apiKey && apiSecret && !cancelled) {
                            const searchStartMs = exitMs - (7 * 24 * 3600 * 1000); // 7 días atrás
                            const execQuery     = `category=linear&symbol=${trade.pair}&startTime=${searchStartMs}&endTime=${exitMs}&limit=100&execType=Trade`;
                            const execData      = await bybitAuthFetch('/v5/execution/list', execQuery, apiKey, apiSecret);

                            console.log('[TradeChart] execData retCode:', execData.retCode, '| total execs:', execData.result?.list?.length);

                            if (!cancelled && execData.retCode === 0 && execData.result?.list?.length > 0) {
                                const execs = execData.result.list;

                                // Log de todas las ejecuciones para debug
                                console.log('[TradeChart] execs:', execs.map(e => ({
                                    time: new Date(parseInt(e.execTime)).toLocaleString(),
                                    side: e.side,
                                    price: e.execPrice,
                                    qty: e.execQty,
                                })));

                                // Buscar SOLO cerca del entryPrice (0.5% tolerancia)
                                // El exitPrice atrae demasiados falsos positivos
                                const tolerance = trade.entryPrice * 0.005;

                                const matching = execs.filter(e =>
                                    Math.abs(parseFloat(e.execPrice) - trade.entryPrice) <= tolerance
                                );

                                console.log('[TradeChart] matching execs:', matching.length, '| entryPrice:', trade.entryPrice, '| tolerance:', tolerance.toFixed(6));

                                if (matching.length > 0) {
                                    // Tomar el MÁS RECIENTE antes del cierre = apertura de ESTE trade
                                    const latest = matching.reduce((a, b) =>
                                        parseInt(a.execTime) > parseInt(b.execTime) ? a : b
                                    );
                                    actualEntryMs = parseInt(latest.execTime);
                                }
                            }
                        } else {
                            console.log('[TradeChart] Sin credenciales de Bybit disponibles');
                        }
                    } catch (e) {
                        console.log('[TradeChart] Error buscando ejecuciones:', e.message);
                    }

                    if (cancelled) return;

                    // ── Rango final incluyendo la entrada real ─────────────────
                    const rangeStart = Math.min(actualEntryMs, entryMs) - pad;
                    const rangeEnd   = exitMs + pad;

                    // ── Fetch velas ───────────────────────────────────────────
                    const intervalSec = parseInt(interval) * 60;
                    const params      = new URLSearchParams({
                        category: 'linear',
                        symbol:   trade.pair,
                        interval,
                        start:    String(rangeStart),
                        end:      String(rangeEnd),
                        limit:    '300',
                    });

                    const klineRes  = await fetch(`https://api.bybit.com/v5/market/kline?${params}`);
                    const klineData = await klineRes.json();

                    if (cancelled || !chartRef.current) return;

                    if (klineData.retCode !== 0) {
                        setError(`Error Bybit: ${klineData.retMsg}`);
                        setLoading(false);
                        return;
                    }

                    const raw = klineData.result?.list || [];
                    if (raw.length === 0) {
                        setError('Sin datos de velas para este período');
                        setLoading(false);
                        return;
                    }

                    // Timezone offset: UTC → hora local
                    const tzSec = -new Date().getTimezoneOffset() * 60;

                    const candles = raw
                        .map(c => ({
                            time:  Math.floor(parseInt(c[0]) / 1000) + tzSec,
                            open:  parseFloat(c[1]),
                            high:  parseFloat(c[2]),
                            low:   parseFloat(c[3]),
                            close: parseFloat(c[4]),
                        }))
                        .sort((a, b) => a.time - b.time);

                    seriesRef.current.setData(candles);

                    // ── Snap timestamp → vela más cercana ─────────────────────
                    const snapToCandle = (tsMs) => {
                        const tsSec   = Math.floor(tsMs / 1000) + tzSec;
                        const snapped = Math.floor(tsSec / intervalSec) * intervalSec;
                        const exact   = candles.find(c => c.time === snapped);
                        if (exact) return exact.time;
                        return candles.reduce((best, c) =>
                            Math.abs(c.time - tsSec) < Math.abs(best.time - tsSec) ? c : best
                        ).time;
                    };

                    // ── Marcadores ────────────────────────────────────────────
                    const isLong  = trade.action?.includes('Long');
                    const markers = [];

                    markers.push({
                        time:     snapToCandle(actualEntryMs),
                        position: isLong ? 'belowBar' : 'aboveBar',
                        color:    '#10b981',
                        shape:    isLong ? 'arrowUp' : 'arrowDown',
                        text:     'ENTRADA',
                        size:     2,
                    });

                    if (trade.exitTime) {
                        markers.push({
                            time:     snapToCandle(exitMs),
                            position: isLong ? 'aboveBar' : 'belowBar',
                            color:    '#ef4444',
                            shape:    isLong ? 'arrowDown' : 'arrowUp',
                            text:     'SALIDA',
                            size:     2,
                        });
                    }

                    markers.sort((a, b) => a.time - b.time);

                    // Si caen en la misma vela, separar arriba/abajo
                    if (markers.length === 2 && markers[0].time === markers[1].time) {
                        markers[0].position = isLong ? 'belowBar' : 'aboveBar';
                        markers[1].position = isLong ? 'aboveBar' : 'belowBar';
                    }

                    createSeriesMarkers(seriesRef.current, markers);

                    // Zoom al rango
                    chart.timeScale().setVisibleRange({
                        from: Math.floor(rangeStart / 1000) + tzSec,
                        to:   Math.floor(rangeEnd   / 1000) + tzSec,
                    });

                    setLoading(false);
                } catch (err) {
                    if (!cancelled) {
                        setError(`Error: ${err.message}`);
                        setLoading(false);
                    }
                }
            })();

            return () => ro.disconnect();
        });

        return () => {
            cancelled = true;
            cancelAnimationFrame(raf);
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current  = null;
                seriesRef.current = null;
            }
        };
    }, [trade, interval, bybitCreds]);

    return (
        <div className="flex flex-col gap-2">
            <div className="flex gap-1">
                {INTERVALS.map(({ label, value }) => (
                    <button
                        key={value}
                        onClick={() => setInterval(value)}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                            interval === value
                                ? 'bg-cyan-500 text-white'
                                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <div className="relative rounded-xl overflow-hidden border border-gray-700" style={{ height: '380px' }}>
                {loading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                        <div className="flex flex-col items-center gap-2 text-gray-400">
                            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm">Cargando velas...</span>
                        </div>
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                        <p className="text-red-400 text-sm text-center px-4">{error}</p>
                    </div>
                )}
                <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
            </div>
        </div>
    );
}
