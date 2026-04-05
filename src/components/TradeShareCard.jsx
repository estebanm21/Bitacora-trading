import { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import { Share2, Download, X } from 'lucide-react';
import logo from '../assets/logo_trade.png';
import cohete from '../assets/cohete.png';
import cohetePerdedor from '../assets/cohete_perdedor.png';

export default function TradeShareCard({ trade }) {
    const cardRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);

    const isWin = trade.result === 'win';
    const isLong = trade.action?.includes('Long');

    const capitalOperado = trade.entryPrice && trade.qty && trade.leverage
        ? (trade.entryPrice * trade.qty) / trade.leverage
        : trade.cumExitValue || 0;
    const roi = capitalOperado > 0 ? (trade.pnl / capitalOperado) * 100 : null;
    const roiDisplay = roi !== null ? `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%` : `${trade.pnl >= 0 ? '+' : ''}$${Math.abs(trade.pnl).toFixed(2)}`;
    const pnlDisplay = `${trade.pnl >= 0 ? '+' : '-'}$${Math.abs(trade.pnl).toFixed(2)}`;

    const mainColor = isWin ? '#16a34a' : '#dc2626';
    const lightColor = isWin ? '#22c55e' : '#ef4444';
    const glowColor = isWin ? '#22c55e66' : '#ef444466';
    const bgGrad = isWin
        ? 'linear-gradient(90deg, #041a04 0%, #020e02 25%, #010601 45%, #000000 65%)'
        : 'linear-gradient(90deg, #1a0404 0%, #100303 25%, #080101 45%, #000000 65%)';

    const capture = async () => {
        if (!cardRef.current) return;
        setSaving(true);
        try {
            const canvas = await html2canvas(cardRef.current, {
                scale: 3,
                useCORS: true,
                backgroundColor: null,
                logging: false,
            });
            const url = canvas.toDataURL('image/png');
            // Web Share API con archivos solo funciona en móvil
            const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
            if (isMobile && navigator.canShare && navigator.canShare({ files: [new File([], 'test.png')] })) {
                const blob = await (await fetch(url)).blob();
                const file = new File([blob], `${trade.pair}-trade.png`, { type: 'image/png' });
                await navigator.share({ files: [file], title: `Trade ${trade.pair}` });
            } else {
                const a = document.createElement('a');
                a.href = url;
                a.download = `${trade.pair}-${trade.date}.png`;
                a.click();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-all"
            >
                <Share2 className="w-4 h-4" />
                Compartir
            </button>

            {open && (
                <div
                    className="fixed inset-0 bg-black/85 flex items-center justify-center z-[60] p-4"
                    onClick={() => setOpen(false)}
                >
                    <div className="flex flex-col items-center gap-5" style={{ maxWidth: '95vw', overflowX: 'hidden' }} onClick={e => e.stopPropagation()}>

                        {/* ── Tarjeta rectangular ── */}
                        <div
                            ref={cardRef}
                            style={{
                                width: '650px',
                                height: '300px',
                                background: bgGrad,
                                borderRadius: '14px',
                                overflow: 'hidden',
                                fontFamily: 'system-ui, -apple-system, sans-serif',
                                position: 'relative',
                                boxSizing: 'border-box',
                                display: 'flex',
                            }}
                        >
                            {/* Partículas de fondo */}
                            {[...Array(30)].map((_, i) => (
                                <div key={i} style={{
                                    position: 'absolute',
                                    width: `${Math.random() * 2.5 + 0.5}px`,
                                    height: `${Math.random() * 2.5 + 0.5}px`,
                                    borderRadius: '50%',
                                    background: lightColor,
                                    opacity: Math.random() * 0.4 + 0.05,
                                    top: `${Math.random() * 100}%`,
                                    left: `${Math.random() * 100}%`,
                                    pointerEvents: 'none',
                                }} />
                            ))}

                            {/* ── Lado izquierdo ── */}
                            <div style={{
                                width: '310px',
                                flexShrink: 0,
                                padding: '24px 20px 20px 24px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                justifyContent: 'space-between',
                                position: 'relative',
                                zIndex: 1,
                            }}>
                                {/* Logo */}
                                <img
                                    src={logo}
                                    alt="logo"
                                    style={{ height: '42px', objectFit: 'contain', objectPosition: 'left' }}
                                />

                                {/* Par + dirección + apalancamiento */}
                                <div style={{ marginTop: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                        <span style={{ color: '#fff', fontWeight: 800, fontSize: '20px' }}>
                                            {trade.pair}
                                        </span>
                                        <span style={{
                                            background: `${mainColor}55`,
                                            color: lightColor,
                                            borderRadius: '8px',
                                            padding: '3px 12px',
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            border: `1px solid ${lightColor}55`,
                                            lineHeight: '1.4',
                                            display: 'inline-block',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {isLong ? 'Long' : 'Short'} {trade.leverage}x
                                        </span>
                                    </div>

                                    {/* ROI grande */}
                                    <div style={{
                                        fontSize: '52px',
                                        fontWeight: 900,
                                        color: lightColor,
                                        lineHeight: 1,
                                        textShadow: `0 0 24px ${glowColor}`,
                                        letterSpacing: '-1px',
                                        textAlign: 'left',
                                    }}>
                                        {roiDisplay}
                                    </div>
                                    {roi !== null && (
                                        <div style={{
                                            fontSize: '16px',
                                            fontWeight: 600,
                                            color: `${lightColor}cc`,
                                            marginTop: '4px',
                                            textAlign: 'left',
                                        }}>
                                            {pnlDisplay} USDT
                                        </div>
                                    )}
                                </div>

                                {/* Precios + broker */}
                                <div style={{ marginTop: 'auto', paddingTop: '14px' }}>
                                    {trade.entryPrice > 0 && (
                                        <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: '1.6', textAlign: 'left' }}>
                                            Precio de Entrada: <span style={{ color: '#d1fae5' }}>${trade.entryPrice.toFixed(4)}</span>
                                        </div>
                                    )}
                                    {trade.exitPrice > 0 && (
                                        <div style={{ color: '#9ca3af', fontSize: '12px', lineHeight: '1.6' }}>
                                            Precio de Ejecución: <span style={{ color: '#d1fae5' }}>${trade.exitPrice.toFixed(4)}</span>
                                        </div>
                                    )}
                                    <div style={{
                                        color: '#6b7280',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        letterSpacing: '0.08em',
                                        marginTop: '4px',
                                        textAlign: 'left'
                                    }}>
                                        BYBIT
                                    </div>
                                </div>
                            </div>

                            {/* ── Lado derecho — espacio para imagen decorativa ── */}
                            <div style={{
                                width: '340px',
                                flexShrink: 0,
                                position: 'relative',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                            }}>
                                {/* Glow central */}
                                <div style={{
                                    position: 'absolute',
                                    width: '160px',
                                    height: '160px',
                                    borderRadius: '50%',
                                    background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)`,
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                }} />

                                {isWin ? (
                                    <img
                                        src={cohete}
                                        alt="cohete"
                                        style={{
                                            position: 'absolute',
                                            zIndex: 1,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                            objectPosition: 'center',
                                        }}
                                    />
                                ) : (
                                    <img
                                        src={cohetePerdedor}
                                        alt="cohete perdedor"
                                        style={{
                                            position: 'absolute',
                                            zIndex: 1,
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                            objectPosition: 'center',
                                        }}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Botones */}
                        <div className="flex gap-3">
                            <button
                                onClick={capture}
                                disabled={saving}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold text-sm transition-all disabled:opacity-50"
                            >
                                <Download className="w-4 h-4" />
                                {saving ? 'Guardando...' : 'Descargar / Compartir'}
                            </button>
                            <button
                                onClick={() => setOpen(false)}
                                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 font-bold text-sm transition-all"
                            >
                                <X className="w-4 h-4" />
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
