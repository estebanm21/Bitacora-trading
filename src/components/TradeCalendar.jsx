import React, { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const TradeCalendar = ({ trades = [], currentMonth }) => {
    const [viewMonth, setViewMonth] = React.useState(() => {
        if (currentMonth) return currentMonth;
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    const [year, month] = viewMonth.split('-').map(Number);

    // Agrupar trades por día
    const tradesByDay = useMemo(() => {
        const map = {};
        trades.forEach(trade => {
            const day = trade.date;
            if (!map[day]) map[day] = { pnl: 0, count: 0, wins: 0, losses: 0 };
            const pnl = trade.result === 'win' ? trade.amount : -trade.amount;
            map[day].pnl += pnl;
            map[day].count += 1;
            if (trade.result === 'win') map[day].wins++;
            else map[day].losses++;
        });
        return map;
    }, [trades]);

    // Construir días del mes
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();

    // Semanas
    const weeks = useMemo(() => {
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        for (let d = 1; d <= daysInMonth; d++) days.push(d);
        while (days.length % 7 !== 0) days.push(null);

        const result = [];
        for (let i = 0; i < days.length; i += 7) {
            result.push(days.slice(i, i + 7));
        }
        return result;
    }, [year, month, firstDay, daysInMonth]);

    // Stats por semana
    const weekStats = useMemo(() => {
        return weeks.map(week => {
            let pnl = 0, count = 0;
            week.forEach(day => {
                if (!day) return;
                const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const d = tradesByDay[key];
                if (d) { pnl += d.pnl; count += d.count; }
            });
            return { pnl, count };
        });
    }, [weeks, tradesByDay, year, month]);

    // Stats del mes
    const monthStats = useMemo(() => {
        let pnl = 0, count = 0, tradingDays = 0;
        Object.entries(tradesByDay).forEach(([date, data]) => {
            if (date.startsWith(viewMonth)) {
                pnl += data.pnl;
                count += data.count;
                tradingDays++;
            }
        });
        return { pnl, count, tradingDays };
    }, [tradesByDay, viewMonth]);

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const prevMonth = () => {
        const d = new Date(year, month - 2, 1);
        setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const nextMonth = () => {
        const d = new Date(year, month, 1);
        setViewMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    };
    const goToday = () => {
        const now = new Date();
        setViewMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    };

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const getWeekRange = (week) => {
        const validDays = week.filter(Boolean);
        if (!validDays.length) return '';
        const first = validDays[0];
        const last = validDays[validDays.length - 1];
        const monthAbbr = monthNames[month - 1].slice(0, 3).toLowerCase();
        return `${monthAbbr} ${first} - ${monthAbbr} ${last}`;
    };

    return (
        <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-all">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <h2 className="text-xl font-bold text-white">
                            {monthNames[month - 1]} {year}
                        </h2>
                        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-all">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* Stats del mes */}
                        <div className="flex items-center gap-4 text-sm">
                            <span className="text-gray-500">{monthStats.tradingDays}d activos</span>
                            <span className="text-gray-500">{monthStats.count} trades</span>
                            <span className={`font-bold text-base ${monthStats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {monthStats.pnl >= 0 ? '+' : ''}${monthStats.pnl.toFixed(2)}
                            </span>
                        </div>
                        <button onClick={goToday} className="text-xs px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-600/30 transition-all font-medium">
                            Hoy
                        </button>
                    </div>
                </div>

                {/* Días de la semana */}
                <div className="grid grid-cols-8 gap-1 mb-1">
                    <div /> {/* espacio para stats semana */}
                    {dayNames.map(d => (
                        <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2 uppercase tracking-wider">
                            {d}
                        </div>
                    ))}
                </div>
            </div>

            {/* Calendario */}
            <div className="px-6 pb-6 space-y-1">
                {weeks.map((week, wi) => {
                    const ws = weekStats[wi];
                    const hasActivity = ws.count > 0;

                    return (
                        <div key={wi}>
                            {/* Fila de días */}
                            <div className="grid grid-cols-8 gap-1">
                                {/* Stats de la semana */}
                                <div className="flex flex-col items-start justify-center px-2 py-1">
                                    {hasActivity && (
                                        <>
                                            <span className="text-xs text-gray-600 font-medium leading-none mb-1">
                                                S{wi + 1}
                                            </span>
                                            <span className={`text-xs font-bold leading-none ${ws.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {ws.pnl >= 0 ? '+' : ''}${ws.pnl.toFixed(0)}
                                            </span>
                                        </>
                                    )}
                                </div>

                                {/* Días */}
                                {week.map((day, di) => {
                                    if (!day) return <div key={di} className="h-16" />;

                                    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                    const dayData = tradesByDay[dateKey];
                                    const isToday = dateKey === todayStr;
                                    const hasTrades = !!dayData;
                                    const isPositive = dayData?.pnl >= 0;

                                    return (
                                        <div
                                            key={di}
                                            className={`
                        relative h-16 rounded-xl flex flex-col items-center justify-center transition-all
                        ${isToday ? 'ring-2 ring-cyan-500' : ''}
                        ${hasTrades
                                                    ? isPositive
                                                        ? 'bg-emerald-900/40 border border-emerald-500/30 hover:bg-emerald-900/60'
                                                        : 'bg-red-900/40 border border-red-500/30 hover:bg-red-900/60'
                                                    : 'bg-gray-800/30 border border-gray-800 hover:bg-gray-800/50'
                                                }
                        cursor-default
                      `}
                                        >
                                            {/* Número del día */}
                                            <span className={`text-xs font-semibold leading-none mb-1 ${isToday ? 'text-cyan-400' :
                                                    hasTrades ? (isPositive ? 'text-emerald-300' : 'text-red-300') :
                                                        'text-gray-500'
                                                }`}>
                                                {day}
                                            </span>

                                            {hasTrades && (
                                                <>
                                                    {/* PnL */}
                                                    <span className={`text-xs font-bold leading-none ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {isPositive ? '+' : ''}${Math.abs(dayData.pnl).toFixed(0)}
                                                    </span>
                                                    {/* Número de trades */}
                                                    <span className="text-xs text-gray-500 leading-none mt-0.5">
                                                        {dayData.count}t
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Resumen semanal */}
                            {hasActivity && (
                                <div className="grid grid-cols-8 gap-1 mt-0.5 mb-1">
                                    <div />
                                    <div className="col-span-7 flex items-center justify-between px-2 py-1.5 rounded-lg bg-gray-800/40 border border-gray-800">
                                        <span className="text-xs text-gray-500">{getWeekRange(week)}</span>
                                        <div className="flex items-center gap-4">
                                            {ws.pnl !== 0 && (
                                                <>
                                                    <span className="text-xs text-gray-500">{ws.count}d</span>
                                                    <span className={`text-xs font-bold ${ws.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {ws.pnl >= 0 ? '+' : ''}${ws.pnl.toFixed(2)}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default TradeCalendar;