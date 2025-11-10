import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, DollarSign, Calendar, BarChart3, PieChart, Plus, Trash2, Download, Upload, Archive, ChevronRight, ArrowLeft, Save, Cloud, CloudOff } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from '../config/supabase'; // Asegúrate de crear este archivo

const TradingJournal = () => {
    const [view, setView] = useState('current');
    const [selectedMonth, setSelectedMonth] = useState(null);
    const [userId, setUserId] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState(null);

    const [initialCapital, setInitialCapital] = useState(1000);
    const [trades, setTrades] = useState([]);
    const [monthlyHistory, setMonthlyHistory] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

    const [newTrade, setNewTrade] = useState({
        pair: '',
        leverage: 1,
        result: 'win',
        amount: 0,
        date: new Date().toISOString().split('T')[0]
    });

    // Cargar userId del localStorage o generar uno nuevo
    useEffect(() => {
        let storedUserId = localStorage.getItem('trading_user_id');
        if (!storedUserId) {
            storedUserId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('trading_user_id', storedUserId);
        }
        setUserId(storedUserId);
        loadFromCloud(storedUserId);
    }, []);

    // Auto-guardar cada vez que cambien los datos
    useEffect(() => {
        if (userId && !isSyncing) {
            const timer = setTimeout(() => {
                saveToCloud();
            }, 2000); // Guarda 2 segundos después del último cambio
            return () => clearTimeout(timer);
        }
    }, [trades, monthlyHistory, initialCapital, currentMonth, userId]);

    // Cargar datos desde Supabase
    const loadFromCloud = async (user_id) => {
        try {
            setIsSyncing(true);
            const { data, error } = await supabase
                .from('trading_journal')
                .select('*')
                .eq('user_id', user_id)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                console.error('Error al cargar:', error);
                return;
            }

            if (data) {
                setInitialCapital(data.initial_capital || 1000);
                setTrades(data.trades || []);
                setMonthlyHistory(data.monthly_history || []);
                setCurrentMonth(data.current_month || new Date().toISOString().slice(0, 7));
                setLastSync(new Date(data.updated_at));
            }
        } catch (error) {
            console.error('Error al cargar desde la nube:', error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Guardar datos en Supabase
    const saveToCloud = async () => {
        if (!userId) return;

        try {
            setIsSyncing(true);
            const journalData = {
                user_id: userId,
                initial_capital: initialCapital,
                trades: trades,
                monthly_history: monthlyHistory,
                current_month: currentMonth,
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('trading_journal')
                .upsert(journalData, { onConflict: 'user_id' });

            if (error) throw error;

            setLastSync(new Date());
        } catch (error) {
            console.error('Error al guardar en la nube:', error);
            alert('Error al sincronizar con la nube. Verifica tu conexión.');
        } finally {
            setIsSyncing(false);
        }
    };

    const calculateStats = (tradesList, initialCap) => {
        let currentBalance = initialCap;
        let totalWins = 0;
        let totalLosses = 0;
        let winAmount = 0;
        let lossAmount = 0;
        let maxDrawdown = 0;
        let peak = initialCap;



        const balanceHistory = [{ date: 'Inicio', balance: initialCap }];

        tradesList.forEach((trade, index) => {
            const amount = parseFloat(trade.amount) || 0;
            if (trade.result === 'win') {
                currentBalance += amount;
                totalWins++;
                winAmount += amount;
            } else {
                currentBalance -= amount;
                totalLosses++;
                lossAmount += amount;
            }

            if (currentBalance > peak) peak = currentBalance;
            const drawdown = ((peak - currentBalance) / peak) * 100;
            if (drawdown > maxDrawdown) maxDrawdown = drawdown;

            balanceHistory.push({
                date: `Op ${index + 1}`,
                balance: currentBalance
            });
        });

        const totalTrades = tradesList.length;
        const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
        const profitLoss = currentBalance - initialCap;
        const roi = initialCap > 0 ? ((profitLoss / initialCap) * 100) : 0;

        let totalProfit = winAmount - lossAmount


        return {
            currentBalance,
            totalWins,
            totalLosses,
            totalTrades,
            winRate,
            profitLoss,
            roi,
            winAmount,
            lossAmount,
            maxDrawdown,
            balanceHistory,
            totalProfit
        };
    };

    const stats = calculateStats(trades, initialCapital);

    const addTrade = () => {
        if (!newTrade.pair || newTrade.amount <= 0) {
            alert('Por favor completa todos los campos correctamente');
            return;
        }

        setTrades([...trades, { ...newTrade, id: Date.now() }]);
        setNewTrade({
            pair: '',
            leverage: 1,
            result: 'win',
            amount: 0,
            date: new Date().toISOString().split('T')[0]
        });
    };

    const deleteTrade = (id) => {
        setTrades(trades.filter(t => t.id !== id));
    };

    const saveCurrentMonth = () => {
        if (trades.length === 0) {
            alert('No hay operaciones para guardar');
            return;
        }

        const monthName = new Date(currentMonth + '-01').toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long'
        });

        const monthData = {
            id: Date.now(),
            month: currentMonth,
            monthName: monthName,
            initialCapital: initialCapital,
            trades: [...trades],
            stats: stats,
            savedDate: new Date().toISOString()
        };

        setMonthlyHistory([monthData, ...monthlyHistory]);
        setInitialCapital(stats.currentBalance);
        setTrades([]);
        setCurrentMonth(new Date().toISOString().slice(0, 7));

        alert(`✅ Mes guardado exitosamente: ${monthName}`);
    };

    const viewMonthDetails = (monthData) => {
        setSelectedMonth(monthData);
        setView('monthDetail');
    };

    const deleteMonth = (id) => {
        if (confirm('¿Estás seguro de eliminar este mes?')) {
            setMonthlyHistory(monthlyHistory.filter(m => m.id !== id));
        }
    };

    const exportData = () => {
        const data = {
            initialCapital,
            trades,
            monthlyHistory,
            currentMonth,
            userId,
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-journal-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    };

    const importData = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    setInitialCapital(data.initialCapital || 1000);
                    setTrades(data.trades || []);
                    setMonthlyHistory(data.monthlyHistory || []);
                    setCurrentMonth(data.currentMonth || new Date().toISOString().slice(0, 7));
                    alert('✅ Datos importados exitosamente');
                } catch (error) {
                    alert('Error al importar el archivo');
                }
            };
            reader.readAsText(file);
        }
    };

    const pairDistribution = {};
    const tradesForChart = view === 'monthDetail' ? selectedMonth?.trades : trades;
    (tradesForChart || []).forEach(trade => {
        pairDistribution[trade.pair] = (pairDistribution[trade.pair] || 0) + 1;
    });
    const pairData = Object.entries(pairDistribution).map(([name, value]) => ({ name, value }));

    const currentStats = view === 'monthDetail' ? selectedMonth?.stats : stats;
    const resultData = [
        { name: 'Ganadas', value: currentStats?.totalWins || 0, color: '#10b981' },
        { name: 'Perdidas', value: currentStats?.totalLosses || 0, color: '#ef4444' }
    ];

    // const COLORS = ['#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
    const COLORS = ['#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

    const SyncIndicator = () => (
        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg text-sm ${isSyncing ? 'bg-yellow-600' : 'bg-green-600'
            }`}>
            {isSyncing ? (
                <>
                    <Cloud className="w-4 h-4 animate-pulse" />
                    <span className="text-white">Sincronizando...</span>
                </>
            ) : (
                <>
                    <Cloud className="w-4 h-4" />
                    <span className="text-white">
                        {lastSync ? `Sincronizado ${lastSync.toLocaleTimeString()}` : 'Sincronizado'}
                    </span>
                </>
            )}
        </div>
    );

    // Vista de Historial Mensual
    if (view === 'history') {
        return (
            <div className="min-h-screen bg-gray-950 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-2xl p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setView('current')}
                                    className="bg-white text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-all"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                                <div>
                                    <h1 className="text-4xl font-bold text-white flex items-center gap-3">
                                        <Archive className="w-10 h-10" />
                                        Historial Mensual
                                    </h1>
                                    <p className="text-purple-100">Todos tus meses guardados</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {monthlyHistory.length === 0 ? (
                        <div className="bg-slate-800 rounded-xl shadow-xl p-12 text-center border border-slate-700">
                            <Archive className="w-20 h-20 text-slate-600 mx-auto mb-4" />
                            <h3 className="text-2xl font-bold text-slate-400 mb-2">No hay meses guardados</h3>
                            <p className="text-slate-500">Guarda tu primer mes desde la vista actual</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {monthlyHistory.map((monthData) => (
                                <div
                                    key={monthData.id}
                                    className="bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700 hover:border-purple-500 transition-all cursor-pointer"
                                    onClick={() => viewMonthDetails(monthData)}
                                >
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-purple-400 capitalize">
                                            {monthData.monthName}
                                        </h3>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                deleteMonth(monthData.id);
                                            }}
                                            className="text-red-400 hover:text-red-300 transition-colors"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Balance Final</span>
                                            <span className="text-white font-bold text-lg">
                                                ${monthData.stats.currentBalance.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">P/L</span>
                                            <span className={`font-bold ${monthData.stats.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {monthData.stats.profitLoss >= 0 ? '+' : ''}${monthData.stats.profitLoss.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">ROI</span>
                                            <span className={`font-bold ${monthData.stats.roi >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                                                {monthData.stats.roi.toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Operaciones</span>
                                            <span className="text-white font-bold">{monthData.stats.totalTrades}</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-400">Win Rate</span>
                                            <span className="text-purple-400 font-bold">{monthData.stats.winRate.toFixed(1)}%</span>
                                        </div>
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

    // Vista de Detalle de Mes
    if (view === 'monthDetail' && selectedMonth) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4 md:p-8">
                <div className="max-w-7xl mx-auto">
                    <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-2xl p-6 mb-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setView('history')}
                                    className="bg-white text-purple-600 p-2 rounded-lg hover:bg-purple-50 transition-all"
                                >
                                    <ArrowLeft className="w-6 h-6" />
                                </button>
                                <div>
                                    <h1 className="text-4xl font-bold text-white capitalize">
                                        {selectedMonth.monthName}
                                    </h1>
                                    <p className="text-purple-100">Detalles completos del mes</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dashboard Stats del Mes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className={`rounded-xl p-6 shadow-lg ${selectedMonth.stats.profitLoss >= 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                            <div className="flex items-center justify-between mb-2">
                                <DollarSign className="w-10 h-10 text-white" />
                                <span className="text-white text-sm font-semibold">Balance Final</span>
                            </div>
                            <p className="text-3xl font-bold text-white">${selectedMonth.stats.currentBalance.toFixed(2)}</p>
                            <p className={`text-sm mt-1 ${selectedMonth.stats.profitLoss >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                                Inicial: ${selectedMonth.initialCapital.toFixed(2)}
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <TrendingUp className="w-10 h-10 text-white" />
                                <span className="text-white text-sm font-semibold">ROI</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{selectedMonth.stats.roi.toFixed(2)}%</p>
                            <p className="text-blue-100 text-sm mt-1">
                                {selectedMonth.stats.profitLoss >= 0 ? '+' : ''}{selectedMonth.stats.profitLoss.toFixed(2)} USDT
                            </p>
                        </div>

                        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <PieChart className="w-10 h-10 text-white" />
                                <span className="text-white text-sm font-semibold">Win Rate</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{selectedMonth.stats.winRate.toFixed(1)}%</p>
                            <p className="text-purple-100 text-sm mt-1">{selectedMonth.stats.totalWins}W / {selectedMonth.stats.totalLosses}L</p>
                        </div>

                        <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-6 shadow-lg">
                            <div className="flex items-center justify-between mb-2">
                                <BarChart3 className="w-10 h-10 text-white" />
                                <span className="text-white text-sm font-semibold">Total Trades</span>
                            </div>
                            <p className="text-3xl font-bold text-white">{selectedMonth.stats.totalTrades}</p>
                            <p className="text-orange-100 text-sm mt-1">Operaciones del mes</p>
                        </div>
                    </div>

                    {/* Gráficas */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                        <div className="bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
                            <h3 className="text-xl font-bold text-purple-400 mb-4">📈 Evolución del Balance</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={selectedMonth.stats.balanceHistory}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="date" stroke="#9ca3af" />
                                    <YAxis stroke="#9ca3af" />
                                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                                    <Line type="monotone" dataKey="balance" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
                            <h3 className="text-xl font-bold text-purple-400 mb-4">🎯 Distribución de Resultados</h3>
                            <ResponsiveContainer width="100%" height={300}>
                                <RePieChart>
                                    <Pie
                                        data={resultData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {resultData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Estadísticas Detalladas */}
                    <div className="bg-slate-800 rounded-xl shadow-xl p-6 mb-6 border border-slate-700">
                        <h3 className="text-xl font-bold text-purple-400 mb-4">📊 Estadísticas Detalladas</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-400 text-sm">💰 Total Ganancias</p>
                                <p className="text-2xl font-bold text-green-400">+${selectedMonth.stats.winAmount.toFixed(2)}</p>
                            </div>



                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-400 text-sm">💵 Profit Neto</p>
                                <p className="text-2xl font-bold text-green-400">+$</p>
                            </div>








                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-400 text-sm">💸 Total Pérdidas</p>
                                <p className="text-2xl font-bold text-red-400">-${selectedMonth.stats.lossAmount.toFixed(2)}</p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg">
                                <p className="text-slate-400 text-sm">📉 Max Drawdown</p>
                                <p className="text-2xl font-bold text-orange-400">{selectedMonth.stats.maxDrawdown.toFixed(2)}%</p>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de Operaciones */}
                    <div className="bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700">
                        <div className="p-6 bg-slate-750 border-b border-slate-700">
                            <h2 className="text-2xl font-bold text-purple-400">📋 Operaciones del Mes</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Fecha</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Par</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Apalancamiento</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Resultado</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {[...selectedMonth.trades].reverse().map((trade) => (
                                        <tr key={trade.id} className="hover:bg-slate-700 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-300">{trade.date}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-white">{trade.pair}</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{trade.leverage}x</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${trade.result === 'win'
                                                    ? 'bg-green-900 text-green-300'
                                                    : 'bg-red-900 text-red-300'
                                                    }`}>
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

    // Vista Principal (Mes Actual)
    return (
        <div className="min-h-screen bg-gray-950 p-4 md:p-8">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                {/* <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-2xl p-6 mb-6">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                                <BarChart3 className="w-10 h-10" />
                                Bitácora de Trading Pro
                            </h1>
                            <p className="text-purple-100">Mes actual en progreso</p>
                        </div>
                        <div className="flex flex-col gap-2 mt-4 md:mt-0">
                            <SyncIndicator />
                            <div className="flex gap-2">
                                {view === 'current' && (
                                    <>
                                        <button
                                            onClick={() => setView('history')}
                                            className="bg-white text-purple-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-50 transition-all shadow-lg"
                                        >
                                            <Archive className="w-4 h-4" />
                                            Historial
                                        </button>
                                        <button
                                            onClick={saveCurrentMonth}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg"
                                        >
                                            <Save className="w-4 h-4" />
                                            Guardar Mes
                                        </button>
                                    </>
                                )}
                                <button onClick={exportData} className="bg-white text-purple-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-50 transition-all shadow-lg">
                                    <Download className="w-4 h-4" />
                                    Exportar
                                </button>
                                <label className="bg-white text-purple-600 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-50 transition-all shadow-lg cursor-pointer">
                                    <Upload className="w-4 h-4" />
                                    Importar
                                    <input type="file" accept=".json" onChange={importData} className="hidden" />
                                </label>
                            </div>
                        </div>
                    </div>
                </div> */}

                {/* Header */}
                <div className="bg-gray-900 rounded-2xl shadow-2xl p-6 mb-6 border border-gray-800">
                    <div className="flex flex-col md:flex-row items-center justify-between">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
                                <BarChart3 className="w-10 h-10 text-cyan-400" />
                                Bitácora de Trading Pro
                            </h1>
                            <p className="text-gray-400">Mes actual en progreso</p>
                        </div>
                        <div className="flex gap-2 mt-4 md:mt-0">
                            <button
                                onClick={() => setView('history')}
                                className="bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all shadow-lg border border-gray-700"
                            >
                                <Archive className="w-4 h-4" />
                                Historial
                            </button>
                            <button
                                onClick={saveCurrentMonth}
                                className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-all shadow-lg"
                            >
                                <Save className="w-4 h-4" />
                                Guardar Mes
                            </button>
                            <button onClick={exportData} className="bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all shadow-lg border border-gray-700">
                                <Download className="w-4 h-4" />
                                Exportar
                            </button>
                            <label className="bg-gray-800 text-cyan-400 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-700 transition-all shadow-lg border border-gray-700 cursor-pointer">
                                <Upload className="w-4 h-4" />
                                Importar
                                <input type="file" accept=".json" onChange={importData} className="hidden" />
                            </label>
                        </div>
                    </div>
                </div>




                {/* Capital Inicial */}
                {/* <div className="bg-slate-800 rounded-xl shadow-xl p-6 mb-6 border border-slate-700">
                    <label className="text-slate-300 text-sm font-semibold mb-3 block">💰 Capital Inicial (USDT)</label>
                    <input
                        type="number"
                        value={initialCapital}
                        onChange={(e) => setInitialCapital(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-700 text-white px-4 py-3 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none text-lg font-bold"
                        step="0.01"
                    />
                </div> */}

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

                {/* Dashboard Stats */}
                {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className={`rounded-xl p-6 shadow-lg ${stats.profitLoss >= 0 ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <DollarSign className="w-10 h-10 text-white" />
                            <span className="text-white text-sm font-semibold">Balance Actual</span>
                        </div>
                        <p className="text-3xl font-bold text-white">${stats.currentBalance.toFixed(2)}</p>
                        <p className={`text-sm mt-1 ${stats.profitLoss >= 0 ? 'text-green-100' : 'text-red-100'}`}>
                            {stats.profitLoss >= 0 ? '+' : ''}{stats.profitLoss.toFixed(2)} USDT
                        </p>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <TrendingUp className="w-10 h-10 text-white" />
                            <span className="text-white text-sm font-semibold">ROI</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.roi.toFixed(2)}%</p>
                        <p className="text-blue-100 text-sm mt-1">Retorno de inversión</p>
                    </div>

                    <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <PieChart className="w-10 h-10 text-white" />
                            <span className="text-white text-sm font-semibold">Win Rate</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
                        <p className="text-purple-100 text-sm mt-1">{stats.totalWins}W / {stats.totalLosses}L</p>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <BarChart3 className="w-10 h-10 text-white" />
                            <span className="text-white text-sm font-semibold">Total Trades</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.totalTrades}</p>
                        <p className="text-orange-100 text-sm mt-1">Operaciones registradas</p>
                    </div>
                </div> */}


                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className={`rounded-xl p-6 shadow-lg border ${stats.profitLoss >= 0 ? 'bg-green-900/20 border-green-500/30' : 'bg-red-900/20 border-red-500/30'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <DollarSign className="w-10 h-10 text-white" />
                            <span className="text-gray-400 text-sm font-semibold">Balance Actual</span>
                        </div>
                        <p className="text-3xl font-bold text-white">${stats.currentBalance.toFixed(2)}</p>
                        <p className={`text-sm mt-1 ${stats.profitLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {stats.profitLoss >= 0 ? '+' : ''}{stats.profitLoss.toFixed(2)} USDT
                        </p>
                    </div>

                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <TrendingUp className="w-10 h-10 text-white" />
                            <span className="text-gray-400 text-sm font-semibold">ROI</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.roi.toFixed(2)}%</p>
                        <p className="text-blue-400 text-sm mt-1">Retorno de inversión</p>
                    </div>

                    <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <PieChart className="w-10 h-10 text-white" />
                            <span className="text-gray-400 text-sm font-semibold">Win Rate</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
                        <p className="text-purple-400 text-sm mt-1">{stats.totalWins}W / {stats.totalLosses}L</p>
                    </div>

                    <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <BarChart3 className="w-10 h-10 text-white" />
                            <span className="text-gray-400 text-sm font-semibold">Total Trades</span>
                        </div>
                        <p className="text-3xl font-bold text-white">{stats.totalTrades}</p>
                        <p className="text-amber-400 text-sm mt-1">Operaciones registradas</p>
                    </div>
                </div>





                {/* Formulario Nueva Operación */}
                {/* <div className="bg-slate-800 rounded-xl shadow-xl p-6 mb-6 border border-slate-700">
                    <h2 className="text-2xl font-bold text-purple-400 mb-4 flex items-center gap-2">
                        <Plus className="w-6 h-6" />
                        Nueva Operación
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="text-slate-400 text-sm mb-2 block">📊 Par</label>
                            <input
                                type="text"
                                placeholder="BTC/USDT"
                                value={newTrade.pair}
                                onChange={(e) => setNewTrade({ ...newTrade, pair: e.target.value.toUpperCase() })}
                                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-slate-400 text-sm mb-2 block">⚡ Apalancamiento</label>
                            <input
                                type="number"
                                value={newTrade.leverage}
                                onChange={(e) => setNewTrade({ ...newTrade, leverage: parseInt(e.target.value) || 1 })}
                                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                                min="1"
                                max="125"
                            />
                        </div>
                        <div>
                            <label className="text-slate-400 text-sm mb-2 block">📈 Resultado</label>
                            <select
                                value={newTrade.result}
                                onChange={(e) => setNewTrade({ ...newTrade, result: e.target.value })}
                                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                            >
                                <option value="win">✅ Ganada</option>
                                <option value="loss">❌ Perdida</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-slate-400 text-sm mb-2 block">💵 Monto (USDT)</label>
                            <input
                                type="number"
                                value={newTrade.amount}
                                onChange={(e) => setNewTrade({ ...newTrade, amount: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="text-slate-400 text-sm mb-2 block">📅 Fecha</label>
                            <input
                                type="date"
                                value={newTrade.date}
                                onChange={(e) => setNewTrade({ ...newTrade, date: e.target.value })}
                                className="w-full bg-slate-700 text-white px-4 py-2 rounded-lg border border-slate-600 focus:border-purple-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <button
                        onClick={addTrade}
                        className="mt-4 w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg font-bold flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar Operación
                    </button>
                </div> */}


                {/* Formulario Nueva Operación */}
                <div className="bg-gray-900 rounded-xl shadow-xl p-6 mb-6 border border-gray-800">
                    <h2 className="text-2xl font-bold text-cyan-400 mb-4 flex items-center gap-2">
                        <Plus className="w-6 h-6" />
                        Nueva Operación
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">📊 Par</label>
                            <input
                                type="text"
                                placeholder="BTC/USDT"
                                value={newTrade.pair}
                                onChange={(e) => setNewTrade({ ...newTrade, pair: e.target.value.toUpperCase() })}
                                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">⚡ Apalancamiento</label>
                            <input
                                type="number"
                                value={newTrade.leverage}
                                onChange={(e) => setNewTrade({ ...newTrade, leverage: parseInt(e.target.value) || 1 })}
                                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
                                min="1"
                                max="125"
                            />
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">📈 Resultado</label>
                            <select
                                value={newTrade.result}
                                onChange={(e) => setNewTrade({ ...newTrade, result: e.target.value })}
                                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
                            >
                                <option value="win">✅ Ganada</option>
                                <option value="loss">❌ Perdida</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">💵 Monto (USDT)</label>
                            <input
                                type="number"
                                value={newTrade.amount}
                                onChange={(e) => setNewTrade({ ...newTrade, amount: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm mb-2 block">📅 Fecha</label>
                            <input
                                type="date"
                                value={newTrade.date}
                                onChange={(e) => setNewTrade({ ...newTrade, date: e.target.value })}
                                className="w-full bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-700 focus:border-cyan-500 focus:outline-none"
                            />
                        </div>
                    </div>
                    <button
                        onClick={addTrade}
                        className="mt-4 w-full bg-cyan-600 text-white px-6 py-3 rounded-lg hover:bg-cyan-700 transition-all shadow-lg font-bold flex items-center justify-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Agregar Operación
                    </button>
                </div>






                {/* Gráficas */}
                {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                    <div className="bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
                        <h3 className="text-xl font-bold text-purple-400 mb-4">📈 Evolución del Balance</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={stats.balanceHistory}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis dataKey="date" stroke="#9ca3af" />
                                <YAxis stroke="#9ca3af" />
                                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                                <Line type="monotone" dataKey="balance" stroke="#8b5cf6" strokeWidth={3} dot={{ fill: '#8b5cf6' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="bg-slate-800 rounded-xl shadow-xl p-6 border border-slate-700">
                        <h3 className="text-xl font-bold text-purple-400 mb-4">🎯 Distribución de Resultados</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <RePieChart>
                                <Pie
                                    data={resultData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {resultData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div> */}



                {/* Gráficas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">




                    <div className="bg-gray-900 rounded-xl shadow-xl p-6 border border-gray-800">
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




                    <div className="bg-gray-900 rounded-xl shadow-xl p-6 border border-gray-800">
                        <h3 className="text-xl font-bold text-cyan-400 mb-4">🎯 Distribución de Resultados</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <RePieChart>
                                <Pie
                                    data={resultData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {resultData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </RePieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Estadísticas Detalladas */}
                {/* <div className="bg-slate-800 rounded-xl shadow-xl p-6 mb-6 border border-slate-700">
                    <h3 className="text-xl font-bold text-purple-400 mb-4">📊 Estadísticas Detalladas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-400 text-sm">💰 Total Ganancias</p>
                            <p className="text-2xl font-bold text-green-400">+${stats.winAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-400 text-sm">💸 Total Pérdidas</p>
                            <p className="text-2xl font-bold text-red-400">-${stats.lossAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-400 text-sm">📉 Max Drawdown</p>
                            <p className="text-2xl font-bold text-orange-400">{stats.maxDrawdown.toFixed(2)}%</p>
                        </div>
                    </div>
                    <div className="p-4 ">
                        <div className="bg-slate-700 p-4 rounded-lg">
                            <p className="text-slate-400 text-sm">💵 Balance Neto</p>
                            <p className={stats.totalProfit < 0 ? 'text-2xl font-bold  text-red-400' : 'text-2xl font-bold  text-green-400'}>{stats.totalProfit < 0 ? '-' : '+'}${stats.totalProfit.toFixed(2)}</p>
                        </div>
                    </div>

                </div> */}

                <div className="bg-gray-900 rounded-xl shadow-xl p-6 mb-6 border border-gray-800">
                    <h3 className="text-xl font-bold text-cyan-400 mb-4">📊 Estadísticas Detalladas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <p className="text-gray-400 text-sm">💰 Total Ganancias</p>
                            <p className="text-2xl font-bold text-green-400">+${stats.winAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <p className="text-gray-400 text-sm">💵 Balance Neto</p>
                            <p className={`text-2xl font-bold ${stats.totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {stats.totalProfit >= 0 ? '+' : ''}${stats.totalProfit.toFixed(2)}
                            </p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <p className="text-gray-400 text-sm">💸 Total Pérdidas</p>
                            <p className="text-2xl font-bold text-red-400">-${stats.lossAmount.toFixed(2)}</p>
                        </div>
                        <div className="bg-gray-800 p-4 rounded-lg border border-gray-700">
                            <p className="text-gray-400 text-sm">📉 Max Drawdown</p>
                            <p className="text-2xl font-bold text-orange-400">{stats.maxDrawdown.toFixed(2)}%</p>
                        </div>
                    </div>
                </div>

                {/* Tabla de Operaciones */}
                {/* <div className="bg-slate-800 rounded-xl shadow-xl overflow-hidden border border-slate-700">
                    <div className="p-6 bg-slate-750 border-b border-slate-700">


                        <h2 className="text-2xl font-bold text-purple-400">📋 Historial de Operaciones</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Par</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Apalancamiento</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Resultado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Monto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {trades.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                                            No hay operaciones registradas. ¡Agrega tu primera operación!
                                        </td>
                                    </tr>
                                ) : (
                                    [...trades].reverse().map((trade) => (
                                        <tr key={trade.id} className="hover:bg-slate-700 transition-colors">
                                            <td className="px-6 py-4 text-sm text-slate-300">{trade.date}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-white">{trade.pair}</td>
                                            <td className="px-6 py-4 text-sm text-slate-300">{trade.leverage}x</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${trade.result === 'win'
                                                    ? 'bg-green-900 text-green-300'
                                                    : 'bg-red-900 text-red-300'
                                                    }`}>
                                                    {trade.result === 'win' ? '✅ Ganada' : '❌ Perdida'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold">
                                                <span className={trade.result === 'win' ? 'text-green-400' : 'text-red-400'}>
                                                    {trade.result === 'win' ? '+' : '-'}${parseFloat(trade.amount).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <button
                                                    onClick={() => deleteTrade(trade.id)}
                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div> */}

                <div className="bg-gray-900 rounded-xl shadow-xl overflow-hidden border border-gray-800">
                    <div className="p-6 bg-gray-800 border-b border-gray-700">
                        <h2 className="text-2xl font-bold text-cyan-400">📋 Historial de Operaciones</h2>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Fecha</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Par</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Apalancamiento</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Resultado</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Monto</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {trades.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                                            No hay operaciones registradas. ¡Agrega tu primera operación!
                                        </td>
                                    </tr>
                                ) : (
                                    [...trades].reverse().map((trade) => (
                                        <tr key={trade.id} className="hover:bg-gray-800 transition-colors">
                                            <td className="px-6 py-4 text-sm text-gray-300">{trade.date}</td>
                                            <td className="px-6 py-4 text-sm font-semibold text-white">{trade.pair}</td>
                                            <td className="px-6 py-4 text-sm text-gray-300">{trade.leverage}x</td>
                                            <td className="px-6 py-4 text-sm">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${trade.result === 'win'
                                                    ? 'bg-green-900/50 text-green-300 border border-green-500/30'
                                                    : 'bg-red-900/50 text-red-300 border border-red-500/30'
                                                    }`}>
                                                    {trade.result === 'win' ? '✅ Ganada' : '❌ Perdida'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold">
                                                <span className={trade.result === 'win' ? 'text-green-400' : 'text-red-400'}>
                                                    {trade.result === 'win' ? '+' : '-'}${parseFloat(trade.amount).toFixed(2)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm">
                                                <button
                                                    onClick={() => deleteTrade(trade.id)}
                                                    className="text-red-400 hover:text-red-300 transition-colors"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
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

    );
};

export default TradingJournal;