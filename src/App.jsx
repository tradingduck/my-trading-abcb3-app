import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, onSnapshot, deleteDoc, doc, query, serverTimestamp, getDocs, writeBatch, setDoc, orderBy } from 'firebase/firestore';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie } from 'recharts';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyBJkUVXdLG8oQI_hMZfSiUX_1r5B4UPdzs",
  authDomain: "my-trading-abcb3.firebaseapp.com",
  projectId: "my-trading-abcb3",
  storageBucket: "my-trading-abcb3.appspot.com",
  messagingSenderId: "793941751172",
  appId: "1:793941751172:web:e7d4a9c6c2b1a8d0b1c7c1" 
};

// [FIXED] Using a fixed, hardcoded user ID and project ID for all data paths as requested.
const FIXED_USER_ID = 'gurejr77';
const PROJECT_ID = 'my-trading-abcb3';

// --- Icon Components ---
const TrashIcon = ({ className = "text-gray-400 hover:text-red-500" }) => (<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`${className} transition-colors`}><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" /></svg>);
const PlusCircleIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>);
const XIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>);
const UploadCloudIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-gray-500"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>);
const ChevronLeftIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>);
const ChevronRightIcon = () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>);


// --- Main App Component Wrapper ---
export default function App() { return ( <ErrorBoundary> <TradingJournal /> </ErrorBoundary> ); }

// --- Error Boundary ---
class ErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, errorInfo) { console.error("Uncaught error:", error, errorInfo); }
    render() {
        if (this.state.hasError) {
            return ( <div className="bg-gray-900 text-white min-h-screen p-8 flex flex-col justify-center items-center"> <h1 className="text-3xl text-red-500">앱 실행 중 오류가 발생했습니다.</h1> <p className="mt-4 text-gray-300">불편을 드려 죄송합니다. 페이지를 새로고침해주세요.</p> <pre className="mt-4 p-4 bg-gray-800 text-red-300 rounded-md text-left text-sm"> {this.state.error?.toString()} </pre> </div> );
        }
        return this.props.children;
    }
}

// --- The Actual App Component ---
function TradingJournal() {
    // --- State Declarations ---
    const [appStatus, setAppStatus] = useState('initializing');
    const [statusMessage, setStatusMessage] = useState('앱 초기화 중...');
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [allTrades, setAllTrades] = useState([]);
    const [fundData, setFundData] = useState({ principal: 0 });
    const [deposits, setDeposits] = useState([]);
    const [withdrawals, setWithdrawals] = useState([]);
    const [isFormVisible, setIsFormVisible] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [filter, setFilter] = useState('all');
    const [latestRate, setLatestRate] = useState(1350);
    const [viewModal, setViewModal] = useState({ isOpen: false, trade: null });
    const [mediaModal, setMediaModal] = useState({ isOpen: false, src: '' });
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, tradeToDelete: null });
    const [deleteAllModal, setDeleteAllModal] = useState({ isOpen: false });
    const [currentPage, setCurrentPage] = useState(1);
    const tradesPerPage = 10;
    
    // --- Effects ---

    // 1. Firebase Initialization (Runs only ONCE)
    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            setAuth(getAuth(app));
            setDb(getFirestore(app));
        } catch (e) {
            console.error("Firebase initialization failed:", e);
            setAppStatus('error');
            setStatusMessage("앱 초기화에 실패했습니다.");
        }
    }, []);

    // 2. Auth Handling (Runs when auth object is ready)
    useEffect(() => {
        if (!auth) return;
        
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setIsAuthenticated(true);
            } else {
                signInAnonymously(auth).catch((authError) => {
                    console.error("Anonymous sign-in failed:", authError);
                    setAppStatus('error');
                    setStatusMessage(`인증 실패: ${authError.message}`);
                });
            }
        });
        return () => unsubscribe();
    }, [auth]);

    // 3. Data Fetching (Runs when authenticated)
    useEffect(() => {
        if (!isAuthenticated || !db) return;

        setAppStatus('loading');
        
        const tradesQuery = query(collection(db, `/artifacts/${PROJECT_ID}/users/${FIXED_USER_ID}/trades`), orderBy("createdAt", "desc"));
        const depositsQuery = query(collection(db, `/artifacts/${PROJECT_ID}/users/${FIXED_USER_ID}/deposits`), orderBy("createdAt", "desc"));
        const withdrawalsQuery = query(collection(db, `/artifacts/${PROJECT_ID}/users/${FIXED_USER_ID}/withdrawals`), orderBy("createdAt", "desc"));
        const fundDocRef = doc(db, `/artifacts/${PROJECT_ID}/users/${FIXED_USER_ID}/management/summary`);
        
        const unsubscribers = [
            onSnapshot(tradesQuery, (snapshot) => {
                console.log("onSnapshot: Firebase 데이터 변경 감지!", snapshot.docs.length, "개 문서 업데이트됨.");
                setAllTrades(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                setAppStatus('ready');
            }, (error) => {
                console.error("Error fetching trades:", error);
                setAppStatus('error');
                setStatusMessage("매매 기록 로딩에 실패했습니다. Firebase 보안 규칙을 확인해주세요.");
            }),
            onSnapshot(depositsQuery, (snapshot) => {
                setDeposits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }),
            onSnapshot(withdrawalsQuery, (snapshot) => {
                setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            }),
            onSnapshot(fundDocRef, (doc) => {
                setFundData(doc.exists() ? doc.data() : { principal: 0 });
            })
        ];

        return () => unsubscribers.forEach(unsub => unsub());
    }, [isAuthenticated, db]);


    // 4. Fetch Exchange Rate
    useEffect(() => {
        fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
            .then(res => res.ok ? res.json() : Promise.reject('Response not OK'))
            .then(data => setLatestRate(data.usd.krw)).catch(err => console.error("환율 로딩 실패:", err));
    }, []);

    // 5. Reset page on filter change
    useEffect(() => {
        setCurrentPage(1);
    }, [filter]);

    // --- Data Calculation Memos ---
    const filteredTrades = useMemo(() => allTrades.filter(trade => {
        try {
            if (filter === 'all') return true;
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const tradeDate = new Date(trade.date);
            if (isNaN(tradeDate.getTime())) return false;
            
            switch (filter) {
                case 'today': return tradeDate >= today;
                case 'week': 
                    const weekStart = new Date(today);
                    weekStart.setDate(today.getDate() - (today.getDay() === 0 ? 6 : today.getDay() - 1));
                    return tradeDate >= weekStart;
                case 'month':
                    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
                    return tradeDate >= monthStart;
                case 'year':
                    const yearStart = new Date(today.getFullYear(), 0, 1);
                    return tradeDate >= yearStart;
                default: return true;
            }
        } catch (e) { return false; }
    }), [allTrades, filter]);

    const currentTrades = useMemo(() => {
        const indexOfLastTrade = currentPage * tradesPerPage;
        const indexOfFirstTrade = indexOfLastTrade - tradesPerPage;
        return filteredTrades.slice(indexOfFirstTrade, indexOfLastTrade);
    }, [filteredTrades, currentPage, tradesPerPage]);

    
    const statsData = useMemo(() => {
        const result = {
            cumulativeChartData: [], pieChartData: [{ name: '승리', value: 0, fill: '#22C55E' }, { name: '패배', value: 0, fill: '#EF4444' }],
            stats: { total: 0, wins: 0, losses: 0, winRate: '0.00', totalPL: 0, displayTotalPL: 0, maxDrawdown: 0, averageRr: '0.00', profitFactor: '0.00', roi: '0.00', maxLosingStreak: 0, averageWin: 0, averageLoss: 0, expectancy: 0, longStats: { count: 0, winRate: '0.0', pl: 0 }, shortStats: { count: 0, winRate: '0.0', pl: 0 } }
        };
        const principal = fundData?.principal || 0;
        const tradesChronological = [...allTrades].sort((a, b) => (a.createdAt?.toDate()?.getTime() || 0) - (b.createdAt?.toDate()?.getTime() || 0));
        let currentLosingStreak = 0, maxLosingStreak = 0;
        result.stats.totalPL = tradesChronological.reduce((acc, trade) => {
            if (trade.result === 'Loss') currentLosingStreak++; else { maxLosingStreak = Math.max(maxLosingStreak, currentLosingStreak); currentLosingStreak = 0; }
            const pl = parseFloat(trade.plAmount) || 0;
            return acc + (trade.result === 'Win' ? pl : trade.result === 'Loss' ? -pl : 0);
        }, 0);
        result.stats.maxLosingStreak = Math.max(maxLosingStreak, currentLosingStreak);
        result.stats.roi = principal > 0 ? ((result.stats.totalPL / principal) * 100).toFixed(2) : '0.00';

        const displayTrades = filteredTrades;
        if (displayTrades.length === 0) return result;
        const sortedDisplayTrades = [...displayTrades].sort((a, b) => (a.createdAt?.toDate()?.getTime() || 0) - (b.createdAt?.toDate()?.getTime() || 0));
        let displayCumulativePL = 0, peakPL = 0, maxDD = 0, grossProfit = 0, grossLoss = 0;
        sortedDisplayTrades.forEach(trade => {
            const pl = parseFloat(trade.plAmount) || 0;
            const effectivePl = trade.result === 'Win' ? pl : trade.result === 'Loss' ? -pl : 0;
            displayCumulativePL += effectivePl;
            peakPL = Math.max(peakPL, displayCumulativePL);
            maxDD = Math.max(maxDD, peakPL - displayCumulativePL);
            if (effectivePl > 0) grossProfit += effectivePl; else grossLoss += Math.abs(effectivePl);
        });
        
        let cumulativePL = 0;
        result.cumulativeChartData = sortedDisplayTrades.map((trade, index) => {
            const pl = parseFloat(trade.plAmount) || 0; 
            cumulativePL += (trade.result === 'Win' ? pl : trade.result === 'Loss' ? -pl : 0);
            return { name: `${index + 1}번째`, 누적손익: cumulativePL };
        });

        result.stats.maxDrawdown = maxDD;
        const wins = displayTrades.filter(t => t.result === 'Win').length;
        const losses = displayTrades.filter(t => t.result === 'Loss').length;
        const totalTradesWithResult = wins + losses;
        result.pieChartData = [{ name: '승리', value: wins, fill: '#22C55E' }, { name: '패배', value: losses, fill: '#EF4444' }];
        const averageWin = wins > 0 ? displayTrades.filter(t => t.result === 'Win').reduce((acc, t) => acc + (parseFloat(t.plAmount) || 0), 0) / wins : 0;
        const averageLoss = losses > 0 ? displayTrades.filter(t => t.result === 'Loss').reduce((acc, t) => acc + (parseFloat(t.plAmount) || 0), 0) / losses : 0;
        const tradesWithRr = displayTrades.filter(t => t.rr && Number(t.rr) > 0);
        const averageRr = tradesWithRr.length > 0 ? (tradesWithRr.reduce((acc, t) => acc + (Number(t.rr) || 0), 0) / tradesWithRr.length).toFixed(2) : '0.00';
        const calcPositionStats = (pos) => { const trades = displayTrades.filter(t => t.position === pos); const wins = trades.filter(t => t.result === 'Win').length; const total = trades.filter(t=>t.result !== 'BE').length; const pl = trades.reduce((acc, t) => acc + (t.result === 'Win' ? (parseFloat(t.plAmount) || 0) : t.result === 'Loss' ? -(parseFloat(t.plAmount) || 0) : 0), 0); return { count: trades.length, winRate: total > 0 ? (wins / total * 100).toFixed(1) : '0.0', pl }; };

        result.stats = { ...result.stats, total: displayTrades.length, wins, losses,
            winRate: totalTradesWithResult > 0 ? ((wins / totalTradesWithResult) * 100).toFixed(2) : '0.00',
            displayTotalPL: displayCumulativePL, averageRr, averageWin, averageLoss,
            expectancy: totalTradesWithResult > 0 ? ((wins / totalTradesWithResult) * averageWin) - ((losses / totalTradesWithResult) * averageLoss) : 0,
            profitFactor: grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : "∞",
            longStats: calcPositionStats('Long'), shortStats: calcPositionStats('Short'),
        };
        return result;
    }, [allTrades, filteredTrades, fundData]);
    
    // --- Event Handlers ---
    const confirmDelete = async (tradeToDelete) => {
        if (!db || !FIXED_USER_ID || !tradeToDelete) return;
        setDeleteModal({ isOpen: false });
        try { await deleteDoc(doc(db, `/artifacts/${PROJECT_ID}/users/${FIXED_USER_ID}/trades/${tradeToDelete.id}`)); } 
        catch (error) { console.error(error); alert('삭제 실패'); }
    };
    const confirmDeleteAll = async () => {
        if (!db || allTrades.length === 0) return;
        setIsProcessing(true);
        try {
            const tradesCollectionRef = collection(db, `/artifacts/${PROJECT_ID}/users/${FIXED_USER_ID}/trades`);
            const querySnapshot = await getDocs(tradesCollectionRef);
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (error) { console.error("Error deleting all trades:", error); alert('전체 삭제 실패'); } 
        finally { setDeleteAllModal({ isOpen: false }); setIsProcessing(false); }
    };
    
    // --- Render Logic ---
    if (appStatus !== 'ready') {
        return ( <div className="bg-gray-900 text-white min-h-screen flex flex-col items-center justify-center"> {appStatus === 'error' ? ( <div className="text-red-500 text-xl p-4 text-center">{statusMessage}</div> ) : ( <> <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div> <p className="text-white text-xl mt-4">{statusMessage}</p> </> )} </div> );
    }
    
    return (
        <div className="bg-gray-900 text-gray-200 min-h-screen p-4 sm:p-6 lg:p-8">
            {isProcessing && <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-50"><div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500 mx-auto"></div><p className="text-white text-xl mt-4">처리 중...</p></div></div>}
            
            <ViewModal isOpen={viewModal.isOpen} trade={viewModal.trade} latestRate={latestRate} setViewModal={setViewModal} setMediaModal={setMediaModal} />
            <MediaModal isOpen={mediaModal.isOpen} src={mediaModal.src} setMediaModal={setMediaModal} />
            <DeleteModal isOpen={deleteModal.isOpen} onConfirm={() => confirmDelete(deleteModal.tradeToDelete)} onCancel={() => setDeleteModal({ isOpen: false })} />
            <DeleteAllModal isOpen={deleteAllModal.isOpen} onConfirm={confirmDeleteAll} onCancel={() => setDeleteAllModal({ isOpen: false })} />

             <div className="max-w-7xl mx-auto pb-96">
                <header className="flex flex-wrap justify-between items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-white">나의 트레이딩 저널</h1>
                        <p className="text-xs text-gray-500 mt-1">프로젝트 ID: {PROJECT_ID}</p>
                        <p className="text-xs text-gray-500 mt-1">저장 공간 ID: {FIXED_USER_ID}</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setDeleteAllModal({ isOpen: true })} className="flex items-center justify-center bg-transparent border border-red-600 text-red-400 hover:bg-red-600/20 font-bold py-2 px-4 rounded-lg shadow-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={allTrades.length === 0}><TrashIcon className="text-red-400" /><span>전체 기록 삭제</span></button>
                        <button onClick={() => setIsFormVisible(true)} className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"><PlusCircleIcon /><span>새 매매 기록</span></button>
                    </div>
                </header>
                {isFormVisible && <TradeForm onSaveSuccess={() => setIsFormVisible(false)} onCancel={() => setIsFormVisible(false)} db={db} userId={FIXED_USER_ID} projectId={PROJECT_ID} latestRate={latestRate} />}
                
                <FundManagement fundData={fundData} deposits={deposits} withdrawals={withdrawals} stats={statsData.stats} db={db} userId={FIXED_USER_ID} projectId={PROJECT_ID} />

                <TradeSimulator db={db} userId={FIXED_USER_ID} projectId={PROJECT_ID} latestRate={latestRate} fundData={fundData} />

                <div className="flex flex-wrap gap-2 my-6">{['all', 'year', 'month', 'week', 'today'].map(f => (<button key={f} onClick={() => setFilter(f)} className={`px-4 py-2 text-sm font-medium rounded-lg ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{ {all: '전체', year: '올해', month: '이번 달', week: '이번 주', today: '오늘'}[f] }</button>))}</div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    <div className="lg:col-span-2 bg-gray-800 p-4 rounded-lg border border-gray-700"><h3 className="text-lg font-semibold mb-4 text-white">누적 손익 변화 (원) - { {all: '전체', year: '올해', month: '이번 달', week: '이번 주', today: '오늘'}[filter] }</h3><ResponsiveContainer width="100%" height={300}><LineChart data={statsData.cumulativeChartData}><CartesianGrid strokeDasharray="3 3" stroke="#374151" /><XAxis dataKey="name" stroke="#9CA3AF" /><YAxis stroke="#9CA3AF" tickFormatter={(value) => value.toLocaleString('ko-KR')} allowDecimals={false} /><Tooltip content={({ active, payload, label }) => active && payload?.length ? <div className="bg-gray-700 p-2 border border-gray-600 rounded shadow-lg"><p className="label text-white">{`${label}`}</p><p className="intro text-blue-400">{`누적손익 : ${payload[0].value.toLocaleString('ko-KR')} 원`}</p></div> : null} /><Legend /><Line type="monotone" dataKey="누적손익" name="누적손익" stroke="#3B82F6" strokeWidth={2} dot={false} activeDot={{ r: 6 }}/></LineChart></ResponsiveContainer></div>
                    <div className="bg-gray-800 p-4 rounded-lg border border-gray-700 flex flex-col"><h3 className="text-lg font-semibold text-white text-center mb-2">전략 분석 ({ {all: '전체 기간', year: '올해', month: '이번 달', week: '이번 주', today: '오늘'}[filter] })</h3>
                        <div className="justify-center flex"><ResponsiveContainer width="100%" height={120}><PieChart><Pie data={statsData.pieChartData} cx="50%" cy="50%" innerRadius={30} outerRadius={55} dataKey="value" paddingAngle={5}><Tooltip /></Pie></PieChart></ResponsiveContainer></div>
                        <div className="grid grid-cols-3 gap-3 text-center mt-2"><StatCard label="승률" value={`${statsData.stats.winRate}%`} /><StatCard label="평균 RR" value={`${statsData.stats.averageRr} R`} /><StatCard label="수익률(PF)" value={statsData.stats.profitFactor} /><StatCard label="평균익절" value={`+${statsData.stats.averageWin.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`} color="text-green-400" /><StatCard label="평균손절" value={`-${statsData.stats.averageLoss.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`} color="text-red-400" /><StatCard label="최대연속손실" value={`${statsData.stats.maxLosingStreak} 회`} color="text-red-400" /></div>
                        <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-2 gap-3 text-center"><StatCard label="최대낙폭(MDD)" value={`${statsData.stats.maxDrawdown.toLocaleString('ko-KR', {maximumFractionDigits: 0})} 원`} color="text-red-400" isLarge={true}/><StatCard label="거래 기대값" value={`${statsData.stats.expectancy.toLocaleString('ko-KR', { maximumFractionDigits: 0 })} 원`} color={statsData.stats.expectancy >= 0 ? 'text-green-400' : 'text-red-400'} isLarge={true} /></div>
                        <PositionAnalysis longStats={statsData.stats.longStats} shortStats={statsData.stats.shortStats} />
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg shadow-xl overflow-hidden border border-gray-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-gray-400 uppercase bg-gray-700"><tr><th className="p-3">날짜</th><th className="p-3">종목</th><th className="p-3">포지션</th><th className="p-3 text-right">손익(KRW)</th><th className="p-3 text-center">RR</th><th className="p-3">메모</th><th className="p-3 text-center">삭제</th></tr></thead>
                            <tbody>{currentTrades.map(trade => (<tr key={trade.id} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-700/50 transition-colors align-top cursor-pointer" onClick={() => setViewModal({ isOpen: true, trade })}><td className="p-3 whitespace-nowrap">{trade.date}</td><td className="p-3 font-medium text-white">{trade.asset}</td><td className={`p-3 font-semibold ${trade.position === 'Long' ? 'text-green-400' : 'text-red-400'}`}>{trade.position}</td><td className={`p-3 text-right font-semibold ${trade.result === 'Win' ? 'text-green-500' : 'text-red-500'}`}>{trade.result === 'BE' ? 'BE' : `${trade.result === 'Win' ? '+' : '-'}${(parseFloat(trade.plAmount) || 0).toLocaleString('ko-KR')}`}</td><td className="p-3 text-center text-blue-400">{trade.rr ? `${trade.rr}R` : '-'}</td><td className="p-3 text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs">{trade.notes}</td><td className="p-3 text-center" onClick={e => e.stopPropagation()}><button onClick={() => setDeleteModal({ isOpen: true, tradeToDelete: trade })} className="p-1"><TrashIcon /></button></td></tr>))}{currentTrades.length === 0 && (<tr><td colSpan="7" className="text-center p-8">해당 기간에 기록된 매매가 없습니다.</td></tr>)}</tbody>
                        </table>
                    </div>
                    {filteredTrades.length > tradesPerPage && (
                         <Pagination tradesPerPage={tradesPerPage} totalTrades={filteredTrades.length} paginate={setCurrentPage} currentPage={currentPage} />
                    )}
                </div>
            </div>
        </div>
    );
}

// --- Child Components ---
const ViewModal = ({ isOpen, trade, latestRate, setViewModal, setMediaModal }) => {
    if(!isOpen || !trade) return null;
    return <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setViewModal({ isOpen: false, trade: null })}> <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}> <div className="sticky top-0 bg-gray-800 p-4 border-b border-gray-700 flex justify-between items-center z-10"> <h3 className="text-xl font-bold text-white">{trade.date} / {trade.asset}</h3> <button onClick={() => setViewModal({ isOpen: false, trade: null })} className="text-gray-400 hover:text-white"><XIcon /></button> </div> <div className="p-6 pb-24"> {trade.mediaBase64 && (<img src={trade.mediaBase64} alt="Trade chart" className="w-full rounded-lg mb-6 border border-gray-700 cursor-pointer" onClick={() => setMediaModal({ isOpen: true, src: trade.mediaBase64 })}/>)} <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 text-center"> <div className="bg-gray-700/50 p-3 rounded-lg"><p className="text-sm text-gray-400">포지션</p><p className={`text-lg font-bold ${trade.position === 'Long' ? 'text-green-400' : 'text-red-400'}`}>{trade.position}</p></div> <div className="bg-gray-700/50 p-3 rounded-lg"><p className="text-sm text-gray-400">결과</p><p className={`text-lg font-bold ${trade.result === 'Win' ? 'text-green-500' : 'text-red-500'}`}>{trade.result}</p></div> <div className="bg-gray-700/50 p-3 rounded-lg"><p className="text-sm text-gray-400">계획 RR</p><p className="text-lg font-bold text-blue-400">{trade.rr ? `${trade.rr} R` : 'N/A'}</p></div> <div className="bg-gray-700/50 p-3 rounded-lg"><p className="text-sm text-gray-400">배팅액</p><p className="text-lg font-bold">{(trade.bettingAmount || 0).toLocaleString('ko-KR')} 원</p></div> <div className="bg-gray-700/50 p-3 rounded-lg"><p className="text-sm text-gray-400">손익 (KRW)</p><p className={`text-lg font-bold ${trade.result === 'Win' ? 'text-green-500' : 'text-red-500'}`}>{trade.result === 'BE' ? 'BE' : `${trade.result === 'Win' ? '+' : '-'}${(parseFloat(trade.plAmount) || 0).toLocaleString('ko-KR')} 원`}</p></div> <div className="bg-gray-700/50 p-3 rounded-lg"><p className="text-sm text-gray-400">손익 (USD)</p><p className={`text-lg font-bold ${trade.result === 'Win' ? 'text-green-500' : 'text-red-500'}`}>{trade.result === 'BE' ? 'BE' : `${trade.result === 'Win' ? '+' : '-'}$${((parseFloat(trade.plAmount) || 0) / latestRate).toFixed(2)}`}</p></div> </div> <div><h4 className="text-lg font-semibold text-white mb-2">매매 복기</h4><p className="text-gray-300 bg-gray-900/50 p-4 rounded-lg whitespace-pre-wrap">{trade.notes || '작성된 메모가 없습니다.'}</p></div> </div> </div> </div>;
}
const MediaModal = ({ isOpen, src, setMediaModal }) => {
    if (!isOpen) return null;
    return <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[60] p-4" onClick={() => setMediaModal({ isOpen: false, src: '' })}><button className="absolute top-5 right-5 text-white text-4xl hover:text-gray-300 z-50"><XIcon /></button><img src={src} alt="Trade Media" className="max-w-full max-h-full rounded-lg shadow-2xl" onClick={e => e.stopPropagation()}/></div>;
}
const DeleteModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold text-white mb-4">기록 삭제</h3><p className="text-gray-300 mb-6">정말로 이 매매 기록을 삭제하시겠습니까?</p><div className="flex justify-end space-x-4"><button onClick={onCancel} className="py-2 px-5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">취소</button><button onClick={onConfirm} className="py-2 px-5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors">삭제</button></div></div></div>;
}
const DeleteAllModal = ({ isOpen, onConfirm, onCancel }) => {
    if (!isOpen) return null;
    return <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"><div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-sm"><h3 className="text-lg font-bold text-red-500 mb-4">전체 기록 삭제</h3><p className="text-gray-300 mb-6">모든 매매 기록을 삭제합니다. 이 작업은 되돌릴 수 없습니다.</p><div className="flex justify-end space-x-4"><button onClick={onCancel} className="py-2 px-5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">취소</button><button onClick={onConfirm} className="py-2 px-5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg transition-colors">전체 삭제</button></div></div></div>;
}
const StatCard = ({ label, value, color = "text-blue-400", isLarge = false }) => (<div><p className={`text-xs ${isLarge ? 'md:text-sm' : 'md:text-xs'} text-gray-400`}>{label}</p><p className={`${isLarge ? 'text-xl' : 'text-base'} font-bold ${color}`}>{value}</p></div>);
const Pagination = ({ tradesPerPage, totalTrades, paginate, currentPage }) => {
    const pageNumbers = [];
    for (let i = 1; i <= Math.ceil(totalTrades / tradesPerPage); i++) { pageNumbers.push(i); }
    if(pageNumbers.length <= 1) return null;

    return (
        <nav className="bg-gray-800 px-4 py-3 flex items-center justify-center border-t border-gray-700">
            <div className="flex-1 flex justify-center">
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50">
                    <ChevronLeftIcon />
                </button>
                {pageNumbers.map(number => (
                    <button key={number} onClick={() => paginate(number)} className={`-ml-px relative inline-flex items-center px-4 py-2 border border-gray-600 text-sm font-medium ${currentPage === number ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                        {number}
                    </button>
                ))}
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === pageNumbers.length} className="-ml-px relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-600 bg-gray-700 text-sm font-medium text-gray-300 hover:bg-gray-600 disabled:opacity-50">
                    <ChevronRightIcon />
                </button>
            </div>
        </nav>
    );
};
function FundManagement({ fundData, deposits, withdrawals, stats, db, userId, projectId }) {
    const [principalInput, setPrincipalInput] = useState('');
    const [depositInput, setDepositInput] = useState('');
    const [withdrawalInput, setWithdrawalInput] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    useEffect(() => { setPrincipalInput(fundData?.principal?.toString() || '0'); }, [fundData]);

    const totalDeposits = useMemo(() => deposits.reduce((acc, d) => acc + (d.amount || 0), 0), [deposits]);
    const totalWithdrawals = useMemo(() => withdrawals.reduce((acc, w) => acc + (w.amount || 0), 0), [withdrawals]);
    const totalPrincipal = (fundData?.principal || 0) + totalDeposits;
    const nav = totalPrincipal + stats.totalPL - totalWithdrawals;

    const handleAction = async (action, amountStr, collectionName, callback) => {
        if (!db || !userId) return alert('DB 연결 확인');
        const amount = parseFloat(amountStr);
        if (isNaN(amount) || (action !== 'setPrincipal' && amount <= 0) || (action === 'setPrincipal' && amount < 0)) return alert(`유효한 금액을 입력해주세요.`);
        
        setIsSaving(true);
        try {
            if (action === 'setPrincipal') {
                await setDoc(doc(db, `/artifacts/${projectId}/users/${userId}/management`, 'summary'), { principal: amount }, { merge: true });
            } else {
                await addDoc(collection(db, `/artifacts/${projectId}/users/${userId}/${collectionName}`), { amount, createdAt: serverTimestamp() });
            }
            if (callback) callback();
        } catch (error) { console.error(error); alert('작업 실패'); }
        finally { setIsSaving(false); }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl mb-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6">자금 관리</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                <div className="bg-gray-700/50 p-3 rounded-lg text-center"><p className="text-sm text-gray-400">총 입금액</p><p className="text-xl font-semibold text-white">{totalPrincipal.toLocaleString('ko-KR')} 원</p></div>
                <div className="bg-gray-700/50 p-3 rounded-lg text-center"><p className="text-sm text-gray-400">총 손익</p><p className={`text-xl font-semibold ${stats.totalPL >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.totalPL.toLocaleString('ko-KR')} 원</p></div>
                <div className="bg-gray-700/50 p-3 rounded-lg text-center"><p className="text-sm text-gray-400">총 출금액</p><p className="text-xl font-semibold text-yellow-400">{totalWithdrawals.toLocaleString('ko-KR')} 원</p></div>
                <div className="bg-blue-900/40 p-3 rounded-lg text-center border border-blue-500"><p className="text-sm text-blue-300">현재 순자산</p><p className={`text-xl font-bold ${nav >= totalPrincipal ? 'text-blue-300' : 'text-orange-400'}`}>{nav.toLocaleString('ko-KR')} 원</p></div>
                <div className="bg-gray-700/50 p-3 rounded-lg text-center"><p className="text-sm text-gray-400">수익률(ROI)</p><p className={`text-xl font-semibold ${stats.roi >= 0 ? 'text-green-400' : 'text-red-400'}`}>{stats.roi} %</p></div>
                <div className="bg-gray-700/50 p-3 rounded-lg text-center"><p className="text-sm text-gray-400">손익분기 승률</p><p className="text-xl font-semibold text-cyan-400">{parseFloat(stats.averageRr) > 0 ? `${(1 / (1 + parseFloat(stats.averageRr)) * 100).toFixed(1)} %` : 'N/A'}</p></div>
            </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
                <div>
                    <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-1">초기 원금 설정</label><div className="flex"><input type="number" value={principalInput} onChange={e => setPrincipalInput(e.target.value)} className="w-full bg-gray-700 rounded-l-md p-2" placeholder="초기 원금"/><button onClick={() => handleAction('setPrincipal', principalInput)} disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-r-md text-sm font-semibold shrink-0 disabled:bg-gray-500">저장</button></div></div>
                    <div className="mb-4"><label className="block text-sm font-medium text-gray-300 mb-1">추가 입금</label><div className="flex"><input type="number" value={depositInput} onChange={e => setDepositInput(e.target.value)} className="w-full bg-gray-700 rounded-l-md p-2" placeholder="입금액"/><button onClick={() => handleAction('deposit', depositInput, 'deposits', () => setDepositInput(''))} disabled={isSaving} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-r-md text-sm font-semibold shrink-0 disabled:bg-gray-500">입금</button></div></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">출금</label><div className="flex"><input type="number" value={withdrawalInput} onChange={e => setWithdrawalInput(e.target.value)} className="w-full bg-gray-700 rounded-l-md p-2" placeholder="출금액"/><button onClick={() => handleAction('withdrawal', withdrawalInput, 'withdrawals', () => setWithdrawalInput(''))} disabled={isSaving} className="bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded-r-md text-sm font-semibold shrink-0 disabled:bg-gray-500">출금</button></div></div>
                </div>
                <div className="flex flex-col"><h4 className="text-lg font-semibold text-white mb-2">입출금 내역</h4><div className="bg-gray-900/50 rounded-lg max-h-48 min-h-[12rem] overflow-y-auto p-2 flex-grow"><ul className="divide-y divide-gray-700">{[...deposits, ...withdrawals].sort((a,b) => (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0)).map(item => 'amount' in item && (deposits.some(d => d.id === item.id) ? <li key={`dep-${item.id}`} className="flex justify-between items-center p-2"><span className="text-gray-300">{item.createdAt?.toDate().toLocaleDateString('ko-KR')}</span><span className="font-semibold text-green-400">+ {item.amount.toLocaleString('ko-KR')} 원</span></li> : <li key={`wd-${item.id}`} className="flex justify-between items-center p-2"><span className="text-gray-300">{item.createdAt?.toDate().toLocaleDateString('ko-KR')}</span><span className="font-semibold text-yellow-400">- {item.amount.toLocaleString('ko-KR')} 원</span></li>))}{(deposits.length === 0 && withdrawals.length === 0) && <p className="text-center text-gray-500 p-4">입출금 내역이 없습니다.</p>}</ul></div></div>
            </div>
        </div>
    );
}
function PositionAnalysis({ longStats, shortStats }) {
    return ( <div className="mt-3 pt-3 border-t border-gray-700"> <h4 className="text-sm font-semibold text-center mb-2 text-gray-400">포지션별 분석</h4> <div className="grid grid-cols-2 gap-3"> <div className="bg-gray-900/50 rounded-lg p-2 text-center"><p className="font-bold text-green-400">Long ({longStats.count})</p><p className="text-xs text-gray-400 mt-1">승률: <span className="font-semibold text-white">{longStats.winRate}%</span></p><p className="text-xs text-gray-400">손익: <span className={`font-semibold ${longStats.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{longStats.pl.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span></p></div> <div className="bg-gray-900/50 rounded-lg p-2 text-center"><p className="font-bold text-red-400">Short ({shortStats.count})</p><p className="text-xs text-gray-400 mt-1">승률: <span className="font-semibold text-white">{shortStats.winRate}%</span></p><p className="text-xs text-gray-400">손익: <span className={`font-semibold ${shortStats.pl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{shortStats.pl.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}</span></p></div> </div> </div> );
}
function TradeSimulator({ db, userId, projectId, latestRate, fundData }) {
    const [rr, setRr] = useState('2.0');
    const [riskMode, setRiskMode] = useState('fixed');
    const [fixedRiskAmount, setFixedRiskAmount] = useState('10000');
    const [percentRisk, setPercentRisk] = useState('2');
    const [position, setPosition] = useState('Long');
    const [isSimulating, setIsSimulating] = useState(false);
    const riskAmount = useMemo(() => { if (riskMode === 'percent') return (fundData?.principal || 0) * ((parseFloat(percentRisk) || 0) / 100); return parseFloat(fixedRiskAmount) || 0; }, [riskMode, fixedRiskAmount, percentRisk, fundData]);

    const handleSimulateTrade = async (result) => {
        if (!db || !userId) return alert('DB가 연결되지 않았습니다.');
        if (riskAmount <= 0) return alert('배팅 금액(1R)은 0보다 커야 합니다.');
        setIsSimulating(true);
        const tradeData = { asset: 'Quick Trade', bettingAmount: riskAmount, createdAt: serverTimestamp(), date: new Date().toISOString().slice(0, 10), mediaBase64: '', notes: `시뮬레이터 거래`, plAmount: result === 'Win' ? riskAmount * (parseFloat(rr) || 0) : riskAmount, position, result, rr: parseFloat(rr) || 0, strategy: 'Simulator', usdKrwRate: latestRate || null, };
        try { 
            await addDoc(collection(db, `/artifacts/${projectId}/users/${userId}/trades`), tradeData);
        } catch (error) { console.error(error); alert('시뮬레이션 거래 기록 실패'); }
        finally { setIsSimulating(false); }
    };

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl my-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">단일 거래 시뮬레이터</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4 mb-4 items-end">
                <div><label className="block text-sm font-medium text-gray-300 mb-2">1R 기준 설정</label><div className="flex bg-gray-700 rounded-md p-1 mb-2"><button onClick={() => setRiskMode('fixed')} className={`w-1/2 rounded-md py-1 text-sm ${riskMode === 'fixed' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>고정 금액</button><button onClick={() => setRiskMode('percent')} className={`w-1/2 rounded-md py-1 text-sm ${riskMode === 'percent' ? 'bg-blue-600 text-white' : 'text-gray-300'}`}>원금의 %</button></div>{riskMode === 'fixed' ? ( <input type="number" value={fixedRiskAmount} onChange={e => setFixedRiskAmount(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md" /> ) : ( <div className="flex items-center"><input type="number" value={percentRisk} onChange={e => setPercentRisk(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md" /><span className="ml-2 text-lg">%</span></div> )}<p className="text-xs text-gray-400 mt-2 text-center">계산된 1R: <span className="font-bold text-blue-300">{Math.round(riskAmount).toLocaleString('ko-KR')} 원</span></p></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">포지션</label><div className="flex bg-gray-700 rounded-md p-1"><button onClick={() => setPosition('Long')} className={`w-1/2 py-1 text-sm font-semibold rounded-md ${position === 'Long' ? 'bg-green-600 text-white' : 'text-gray-300'}`}>롱</button><button onClick={() => setPosition('Short')} className={`w-1/2 py-1 text-sm font-semibold rounded-md ${position === 'Short' ? 'bg-red-600 text-white' : 'text-gray-300'}`}>숏</button></div></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">손익비 (RR)</label><input type="number" step="0.1" value={rr} onChange={e => setRr(e.target.value)} className="w-full bg-gray-700 p-2 rounded-md" /></div>
            </div>
            <div className="flex gap-4 mt-6"><button onClick={() => handleSimulateTrade('Win')} disabled={isSimulating} className="w-full py-3 px-4 bg-green-600 hover:bg-green-500 font-bold rounded-lg disabled:opacity-50">승 (Win)</button><button onClick={() => handleSimulateTrade('Loss')} disabled={isSimulating} className="w-full py-3 px-4 bg-red-600 hover:bg-red-500 font-bold rounded-lg disabled:opacity-50">패 (Loss)</button></div>
        </div>
    );
}
function TradeForm({ onSaveSuccess, onCancel, db, userId, projectId, latestRate }) {
    const initialFormData = useMemo(() => ({ date: new Date().toISOString().slice(0, 10), asset: '', strategy: '', position: 'Long', result: 'Win', bettingAmount: '', plAmount: '', notes: '', usdKrwRate: latestRate || '', rr: '', mediaBase64: '' }), [latestRate]);
    const [formData, setFormData] = useState(initialFormData);
    const [isSaving, setIsSaving] = useState(false);
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleMediaChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 700 * 1024) { alert('700KB 미만 이미지 선택'); e.target.value = ""; return; }
        setIsSaving(true);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => { setFormData(prev => ({ ...prev, mediaBase64: reader.result })); setIsSaving(false); };
        reader.onerror = () => { alert("파일 읽기 오류"); setIsSaving(false); };
    };

    const handleSubmit = async (e) => { 
        e.preventDefault(); 
        if (!db || !userId) return alert("DB 연결 확인");
        setIsSaving(true);
        const finalData = { ...formData, bettingAmount: parseFloat(formData.bettingAmount) || 0, plAmount: parseFloat(formData.plAmount) || 0, rr: parseFloat(formData.rr) || null, usdKrwRate: parseFloat(formData.usdKrwRate) || null, createdAt: serverTimestamp() }; 
        try { 
            await addDoc(collection(db, `/artifacts/${projectId}/users/${userId}/trades`), finalData); 
            onSaveSuccess(); 
        } catch (error) { 
            console.error(error); 
            alert(error.code === 'invalid-argument' ? "저장 실패: 이미지 용량 초과 가능성" : "저장 실패");
        } finally {
            setIsSaving(false);
        }
    }

    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-xl mb-8 border border-gray-700">
            <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">날짜</label><input type="date" name="date" value={formData.date} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2"/></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">종목</label><input type="text" name="asset" value={formData.asset} onChange={handleInputChange} placeholder="예: BTC/USDT" className="w-full bg-gray-700 rounded-md p-2"/></div>
                    <div className="md:col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">매매 전략</label><input type="text" name="strategy" value={formData.strategy} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2"/></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">포지션</label><select name="position" value={formData.position} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2"><option value="Long">Long</option><option value="Short">Short</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">결과</label><select name="result" value={formData.result} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2"><option value="Win">Win</option><option value="Loss">Loss</option><option value="BE">BE</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">계획 RR</label><input type="number" step="0.1" name="rr" value={formData.rr} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2"/></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-1">배팅 금액 (원)</label><input type="number" name="bettingAmount" value={formData.bettingAmount} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2"/></div>
                    <div><label className={`block text-sm font-medium mb-1 ${formData.result === 'Win' ? 'text-green-400' : 'text-red-400'}`}>{formData.result === 'Win' ? '이익금 (원)' : '손실금 (원)'}</label><input type="number" name="plAmount" value={formData.plAmount} onChange={handleInputChange} className="w-full bg-gray-700 rounded-md p-2" disabled={formData.result === 'BE'}/></div>
                    <div className="lg:col-span-4 md:col-span-2"><label className="block text-sm font-medium text-gray-300 mb-1">차트 이미지 첨부</label><p className="text-xs text-yellow-400 mb-2">⚠️ 700KB 미만 권장</p><div className="mt-1 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md">{isSaving ? <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div> : formData.mediaBase64 ? (<div className="text-center"><img src={formData.mediaBase64} alt="미리보기" className="max-h-24 mx-auto mb-2 rounded"/><button type="button" onClick={() => setFormData(prev => ({ ...prev, mediaBase64: '' }))} className="text-xs bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded">제거</button></div>) : (<div className="space-y-1 text-center"><UploadCloudIcon /><div className="flex text-sm text-gray-400"><label htmlFor="file-upload" className="relative cursor-pointer bg-gray-700 rounded-md font-medium text-blue-400 px-2"><span>파일 선택</span><input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleMediaChange} accept="image/*"/></label></div></div>)}</div></div>
                    <div className="lg:col-span-4"><label className="block text-sm font-medium text-gray-300 mb-1">매매 복기 및 메모</label><textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="4" className="w-full bg-gray-700 rounded-md p-2"></textarea></div>
                </div>
                <div className="mt-6 flex justify-end space-x-4"><button type="button" onClick={onCancel} className="py-2 px-5 bg-gray-600 hover:bg-gray-500 text-white font-semibold rounded-lg transition-colors">취소</button><button type="submit" className="flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-lg transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed" disabled={isSaving}>{isSaving ? '저장 중...' : '저장하기'}</button></div>
            </form>
        </div>
    );
}
