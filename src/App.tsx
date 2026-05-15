import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, Navigate } from 'react-router-dom';
import { 
  Wallet, ArrowUpRight, ArrowDownRight, Bell, Plus, 
  Search, LayoutDashboard, CreditCard, Settings, LogOut,
  Calendar as CalendarIcon, MessageCircle, Trash2, Edit,
  PieChart, LayoutList, Download
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';

import { auth, db, googleProvider } from './lib/firebase';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, addDoc, doc, updateDoc, deleteDoc, setDoc, limit, getDocs } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/firestore_error';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const location = useLocation();
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path === '/transactions') return 'transactions';
    if (path === '/budgets') return 'budgets';
    if (path === '/reminders') return 'reminders';
    if (path === '/settings') return 'settings';
    if (path === '/guide') return 'guide';
    return 'dashboard';
  };
  const activeTab = getActiveTab();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isReminderOpen, setIsReminderOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [telegramChatId, setTelegramChatId] = useState('');
  const [verificationStatus, setVerificationStatus] = useState<{loading: boolean, success: boolean | null, message: string}>({loading: false, success: null, message: ''});
  
  const [reminders, setReminders] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);

  const [editingReminder, setEditingReminder] = useState<any>(null);
  const [reminderForm, setReminderForm] = useState({
    title: '',
    amount: '',
    frequency: 'once'
  });

  const [txFormOpen, setTxFormOpen] = useState(false);
  const [txForm, setTxForm] = useState({
    desc: '',
    amount: '',
    category: '',
    type: 'expense'
  });

  const [txFilters, setTxFilters] = useState({
    dateFrom: '',
    dateTo: '',
    category: 'all',
    type: 'all'
  });

  const uniqueTxCategories = Array.from(new Set(transactions.map(tx => tx.category))).sort();

  const filteredTransactions = transactions.filter(tx => {
    let dateFromPass = true;
    let dateToPass = true;
    let categoryPass = true;
    let typePass = true;
    
    if (txFilters.dateFrom) dateFromPass = tx.date >= txFilters.dateFrom;
    if (txFilters.dateTo) dateToPass = tx.date <= txFilters.dateTo;
    if (txFilters.category && txFilters.category !== 'all') categoryPass = tx.category === txFilters.category;
    if (txFilters.type && txFilters.type !== 'all') typePass = tx.type === txFilters.type;

    return dateFromPass && dateToPass && categoryPass && typePass;
  });


  const handleExportXLSX = async () => {
    const XLSX = await import('xlsx');
    const data = filteredTransactions.map(t => ({
      Date: t.date,
      Type: t.type,
      Category: t.category,
      Description: t.desc,
      Amount: t.amount
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Transactions");
    XLSX.writeFile(workbook, `transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);
      setAuthLoading(false);
      
      if (currUser) {
        // Create user doc if not exists
        const userRef = doc(db, 'users', currUser.uid);
        try {
          const userSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', currUser.uid), limit(1)));
          if (userSnap.empty) {
            await setDoc(userRef, {
              createdAt: Date.now(),
              updatedAt: Date.now()
            });
          } else {
             setTelegramChatId(userSnap.docs[0].data()?.telegramChatId || '');
          }
        } catch(e) {}
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) {
        setReminders([]);
        setTransactions([]);
        setCategories([]);
        setBudgets([]);
        return;
    }
    
    const qTx = query(collection(db, 'transactions'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubTx = onSnapshot(qTx, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions', auth);
    });

    const qRem = query(collection(db, 'reminders'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubRem = onSnapshot(qRem, (snapshot) => {
      setReminders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reminders', auth);
    });

    const qCats = query(collection(db, 'categories'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubCats = onSnapshot(qCats, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories', auth);
    });

    const qBdg = query(collection(db, 'budgets'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsubBdg = onSnapshot(qBdg, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'budgets', auth);
    });


    return () => {
      unsubTx();
      unsubRem();
      unsubCats();
      unsubBdg();
    };
  }, [user]);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch(e) {
      console.error(e);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleOpenAddReminder = (date?: Date) => {
    setEditingReminder(null);
    setReminderForm({ title: '', amount: '', frequency: 'once' });
    setSelectedDate(date || new Date());
    setIsReminderOpen(true);
  };

  const handleOpenEditReminder = (reminder: any) => {
    setEditingReminder(reminder);
    setReminderForm({
      title: reminder.title,
      amount: reminder.amount.toString(),
      frequency: reminder.frequency.toLowerCase()
    });
    setSelectedDate(new Date(reminder.nextDate));
    setIsReminderOpen(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderForm.title || !reminderForm.amount || !user) return;
    
    const d = selectedDate || new Date();
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const data = {
      title: reminderForm.title,
      amount: Number(reminderForm.amount),
      frequency: reminderForm.frequency,
      nextDate: dateStr,
      isActive: true
    };

    try {
      if (editingReminder) {
        await updateDoc(doc(db, 'reminders', editingReminder.id), {
            ...data,
            updatedAt: Date.now()
        });
      } else {
        await addDoc(collection(db, 'reminders'), {
          ...data,
          userId: user.uid,
          createdAt: Date.now()
        });
      }
      setIsReminderOpen(false);
    } catch (error) {
      handleFirestoreError(error, editingReminder ? OperationType.UPDATE : OperationType.CREATE, 'reminders', auth);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reminders', id));
    } catch(error) {
      handleFirestoreError(error, OperationType.DELETE, 'reminders', auth);
    }
  };

  const handleSaveTransaction = async () => {
     if (!txForm.desc || !txForm.amount || !txForm.category || !user) return;

     const now = new Date();
     const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

     const dbAmount = txForm.type === 'expense' ? -Math.abs(Number(txForm.amount)) : Math.abs(Number(txForm.amount));

     try {
       await addDoc(collection(db, 'transactions'), {
          userId: user.uid,
          desc: txForm.desc,
          category: txForm.category,
          amount: dbAmount,
          date: dateStr,
          type: txForm.type,
          createdAt: Date.now()
       });
       setTxFormOpen(false);
       setTxForm({ desc: '', amount: '', category: '', type: 'expense' });
     } catch (e) {
         handleFirestoreError(e, OperationType.CREATE, 'transactions', auth);
     }
  };

  const handleVerifyTelegram = async () => {
    if (!telegramChatId || !user) return;
    
    setVerificationStatus({ loading: true, success: null, message: '' });
    try {
      await updateDoc(doc(db, 'users', user.uid), {
         telegramChatId,
         updatedAt: Date.now()
      });

      const res = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: telegramChatId })
      });
      const data = await res.json();
      
      if (res.ok) {
        setVerificationStatus({ loading: false, success: true, message: data.message });
      } else {
        setVerificationStatus({ loading: false, success: false, message: data.error });
      }
    } catch (err) {
      setVerificationStatus({ loading: false, success: false, message: 'Failed to connect/update' });
    }
  };

  const hasReminder = (day: Date) => {
    return reminders.some((reminder) => {
      const parts = reminder.nextDate.split('-');
      if (parts.length !== 3) return false;
      return parseInt(parts[2]) === day.getDate() && 
             parseInt(parts[1]) - 1 === day.getMonth() &&
             parseInt(parts[0]) === day.getFullYear()
    });
  };

  const handleDateSelect = (newDate: Date | undefined) => {
    setDate(newDate);
    if (newDate) {
      setSelectedDate(newDate);
      setIsReminderOpen(true);
    }
  };

  const balance = transactions.reduce((acc, tx) => acc + tx.amount, 0);
  const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const expense = Math.abs(transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0));

  if (authLoading) return <div className="h-screen flex items-center justify-center bg-stone-100 text-stone-900 font-mono">LOADING APP...</div>;

  if (!user) {
     return (
       <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center font-sans tracking-tight">
          <div className="max-w-sm w-full space-y-8 bg-white p-8 border-2 border-stone-900 shadow-[8px_8px_0_0_rgba(28,25,23,1)]">
               <div className="text-center">
                 <img src="/favicon.svg" alt="Equilibria Logo" className="w-12 h-12 mx-auto mb-4 border border-stone-800" />
                 <h1 className="text-2xl font-bold font-mono tracking-widest uppercase">Equilibria</h1>
                 <p className="text-stone-500 mt-2 text-sm">Sign in to manage your finances seamlessly.</p>
             </div>
             <Button onClick={handleLogin} className="w-full h-12 rounded-none border-2 border-stone-900 text-sm font-bold uppercase tracking-widest font-mono">
                Log In with Google
             </Button>
          </div>
       </div>
     )
  }

  return (
    <div className="flex h-screen bg-stone-100 text-stone-900 font-sans overflow-hidden selection:bg-stone-200">
      
      {/* Sidebar */}
      <aside className="w-64 bg-stone-950 border-r border-stone-800 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-stone-800">
          <div className="flex items-center gap-3 font-bold text-lg tracking-widest text-stone-50 uppercase">
            <img src="/favicon.svg" alt="Equilibria Logo" className="w-6 h-6 border border-stone-800" />
            <span>Equilibria v1</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <NavItem icon={<LayoutDashboard />} label="Dashboard" active={activeTab === 'dashboard'} to="/" />
          <NavItem icon={<CreditCard />} label="Transactions" active={activeTab === 'transactions'} to="/transactions" />
          <NavItem icon={<PieChart />} label="Budgets" active={activeTab === 'budgets'} to="/budgets" />
          <NavItem icon={<Bell />} label="Reminders" active={activeTab === 'reminders'} to="/reminders" />
          <NavItem icon={<Settings />} label="Settings" active={activeTab === 'settings'} to="/settings" />
          <NavItem icon={<MessageCircle />} label="AI / Bot Guide" active={activeTab === 'guide'} to="/guide" />
        </nav>

        <div className="p-4 border-t border-stone-800">
          <button onClick={handleLogout} className="flex items-center gap-3 px-3 py-2 w-full text-left text-stone-400 hover:bg-stone-900 hover:text-stone-50 rounded-sm transition-colors uppercase tracking-wider text-xs">
            <LogOut className="w-4 h-4" />
            <span className="font-bold">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b-2 border-stone-900 flex items-center justify-between px-6 lg:px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md hidden sm:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input 
                type="text" 
                placeholder="SEARCH TRANSACTIONS..." 
                className="w-full pl-9 pr-4 py-2 bg-stone-100 border-none rounded-none text-xs tracking-wider focus:ring-1 focus:ring-stone-900 outline-none uppercase font-mono placeholder:text-stone-400"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Dialog open={txFormOpen} onOpenChange={setTxFormOpen}>
                 <DialogTrigger className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-stone-900 text-stone-50 hover:bg-stone-800 transition-colors border border-stone-900 rounded-none text-[10px] font-bold uppercase tracking-widest">
                    <Plus className="w-3.5 h-3.5" />
                    Add Tx
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-[425px] rounded-none border border-stone-900 shadow-2xl p-6">
                    <DialogHeader>
                        <DialogTitle className="font-mono uppercase tracking-widest text-sm">Add Transaction</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                           <Label htmlFor="txType" className="text-xs font-bold uppercase tracking-wider text-stone-500">Type</Label>
                           <select 
                               id="txType" 
                               value={txForm.type} 
                               onChange={e => setTxForm({...txForm, type: e.target.value})}
                               className="flex h-10 w-full rounded-none border border-stone-900 bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                           >
                               <option value="expense">Expense (-)</option>
                               <option value="income">Income (+)</option>
                           </select>
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="txDesc" className="text-xs font-bold uppercase tracking-wider text-stone-500">Description</Label>
                           <Input id="txDesc" placeholder="e.g. Nasi Goreng" value={txForm.desc} onChange={e => setTxForm({...txForm, desc: e.target.value})} className="rounded-none border-stone-900" />
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="txCat" className="text-xs font-bold uppercase tracking-wider text-stone-500">Category</Label>
                           <Input id="txCat" list="cat-list-dialog" placeholder="e.g. Food" value={txForm.category} onChange={e => setTxForm({...txForm, category: e.target.value})} className="rounded-none border-stone-900" />
                           <datalist id="cat-list-dialog">
                              {categories.map(c => <option key={c.id} value={c.name} />)}
                           </datalist>
                        </div>
                        <div className="grid gap-2">
                           <Label htmlFor="txAmount" className="text-xs font-bold uppercase tracking-wider text-stone-500">Amount (IDR)</Label>
                           <Input type="number" id="txAmount" placeholder="50000" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} className="rounded-none border-stone-900" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSaveTransaction} className="rounded-none border-2 border-stone-900 bg-stone-900 text-stone-50 font-mono text-xs uppercase tracking-widest font-bold">Save Transaction</Button>
                    </DialogFooter>
                 </DialogContent>
            </Dialog>
            <button className="p-2 text-stone-400 hover:text-stone-900 relative transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-600 rounded-none shadow-sm"></span>
            </button>
            <div className="w-8 h-8 rounded-sm bg-stone-900 text-stone-50 flex items-center justify-center font-mono font-bold text-xs uppercase tracking-widest overflow-hidden">
              {user.photoURL ? <img src={user.photoURL} alt="User" /> : user.email?.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <Routes>
            <Route path="/" element={
              <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Top Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <StatCard 
                title="Total Balance" 
                amount={`IDR ${balance.toLocaleString()}`} 
                trend="" 
                isPositive={balance >= 0} 
                icon={<Wallet className="w-4 h-4" />}
                iconColor="text-stone-900"
              />
              <StatCard 
                title="Total Income" 
                amount={`IDR ${income.toLocaleString()}`} 
                trend="" 
                isPositive={true} 
                icon={<ArrowUpRight className="w-4 h-4" />}
                iconColor="text-stone-500"
              />
              <StatCard 
                title="Total Expense" 
                amount={`IDR ${expense.toLocaleString()}`} 
                trend="" 
                isPositive={false} 
                icon={<ArrowDownRight className="w-4 h-4" />}
                iconColor="text-stone-500"
              />
            </div>

            {/* Analytics Section */}
            <div className="bg-white rounded-none border-2 border-stone-900 p-6 flex flex-col shadow-[4px_4px_0_0_rgba(28,25,23,1)]">
              <h3 className="text-xs font-bold font-mono tracking-widest text-stone-500 uppercase mb-4">Income vs Expense (Last 7 Days)</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={
                    // Simple aggregation by date for the last 7 days
                    Array.from({length: 7}).map((_, i) => {
                      const d = new Date();
                      d.setDate(d.getDate() - i);
                      const dateStr = d.toISOString().split('T')[0];
                      const dayTxs = transactions.filter(t => t.date === dateStr);
                      const inc = dayTxs.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
                      const exp = Math.abs(dayTxs.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0));
                      return { date: d.toLocaleDateString('en-US', {weekday: 'short'}), income: inc, expense: exp };
                    }).reverse()
                  }>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e4" />
                    <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#78716c'}} />
                    <YAxis tickLine={false} axisLine={false} tick={{fontSize: 12, fill: '#78716c'}} tickFormatter={(value) => `Rp${value}`} />
                    <RechartsTooltip cursor={{fill: '#f5f5f4'}} contentStyle={{borderRadius: '0', border: '1px solid #1c1917', boxShadow: '4px 4px 0 0 rgba(28,25,23,1)'}} />
                    <Bar dataKey="income" fill="#1c1917" radius={[2, 2, 0, 0]} barSize={32} />
                    <Bar dataKey="expense" fill="#d6d3d1" radius={[2, 2, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Calendar Section */}
              <div className="lg:col-span-1 bg-white rounded-none border-2 border-stone-900 p-6 flex flex-col items-center shadow-[4px_4px_0_0_rgba(28,25,23,1)]">
                <div className="w-full flex items-center justify-between mb-4">
                  <h3 className="text-xs font-bold font-mono tracking-widest text-stone-500 uppercase">Calendar</h3>
                </div>
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(date) => { setDate(date); handleOpenAddReminder(date); }}
                  className="rounded-none border-stone-200 border bg-stone-50/50 w-full flex justify-center"
                  modifiers={{ hasReminder: (date) => hasReminder(date) }}
                  modifiersClassNames={{
                    hasReminder: "font-bold text-stone-900 border-b-2 border-stone-900 rounded-none bg-stone-200/50"
                  }}
                />

              </div>

              {/* Transactions Section */}
              <div className="lg:col-span-2 bg-white rounded-none border-2 border-stone-900 flex flex-col overflow-hidden shadow-[4px_4px_0_0_rgba(28,25,23,1)]">
                <div className="p-5 border-b-2 border-stone-900 flex items-center justify-between bg-stone-50/50">
                  <h3 className="text-xs font-bold font-mono tracking-widest text-stone-500 uppercase">Recent Transactions</h3>
                  <Button variant="ghost" size="sm" className="text-[10px] text-stone-900 font-bold uppercase tracking-widest rounded-none hover:bg-stone-200">
                    View All
                  </Button>
                </div>
                
                <div className="p-0 overflow-auto flex-1">
                  <Table>
                    <TableHeader className="bg-white sticky top-0 cursor-default">
                      <TableRow className="border-b-2 border-stone-900 hover:bg-transparent">
                        <TableHead className="text-xs border-r-2 border-stone-900 font-bold tracking-wider text-stone-900 uppercase font-mono">Date</TableHead>
                        <TableHead className="text-xs border-r-2 border-stone-900 font-bold tracking-wider text-stone-900 uppercase font-mono">Description</TableHead>
                        <TableHead className="text-xs border-r-2 border-stone-900 font-bold tracking-wider text-stone-900 uppercase font-mono">Category</TableHead>
                        <TableHead className="text-right text-xs font-bold tracking-wider text-stone-900 uppercase font-mono">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="h-24 text-center text-stone-500 font-mono text-sm">No transactions yet.</TableCell>
                        </TableRow>
                      ) : transactions.map((tx) => (
                        <TableRow key={tx.id} className="border-b border-stone-300 hover:bg-stone-50 transition-colors">
                          <TableCell className="text-stone-500 border-r border-stone-300 whitespace-nowrap font-mono text-xs">{tx.date}</TableCell>
                          <TableCell className="font-semibold border-r border-stone-300 text-stone-800 text-sm">{tx.desc}</TableCell>
                          <TableCell className="border-r border-stone-300">
                            <span className="inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-stone-100 text-stone-600 border border-stone-200">
                              {tx.category}
                            </span>
                          </TableCell>
                          <TableCell className={cn(
                            "text-right font-mono font-medium whitespace-nowrap text-sm",
                            tx.type === 'income' ? 'text-stone-900' : 'text-stone-500'
                          )}>
                            {tx.type === 'income' ? '' : '-'}IDR {Math.abs(tx.amount).toLocaleString('id-ID')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                
              </div>
            </div>
          </div>
          } />

          <Route path="/transactions" element={
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b-2 border-stone-900 pb-4">
                <h2 className="text-xl font-bold font-mono tracking-widest text-stone-900 uppercase">Transactions</h2>
                <Button onClick={handleExportXLSX} className="rounded-none bg-stone-900 hover:bg-stone-800 text-stone-50 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                  <Download className="w-3.5 h-3.5" />
                  Export XLSX
                </Button>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Transaction Form Inline */}
                <div className="lg:col-span-1 bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] p-6 flex flex-col h-fit">
                  <h3 className="text-xs font-bold font-mono tracking-widest text-stone-500 uppercase mb-6">New Transaction</h3>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Description</Label>
                      <Input value={txForm.desc} onChange={e => setTxForm({...txForm, desc: e.target.value})} className="mt-1.5 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" placeholder="e.g., Groceries" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Amount</Label>
                      <Input type="number" value={txForm.amount} onChange={e => setTxForm({...txForm, amount: e.target.value})} className="mt-1.5 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" placeholder="150000" />
                    </div>
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Type</Label>
                      <select value={txForm.type} onChange={e => setTxForm({...txForm, type: e.target.value})} className="mt-1.5 flex w-full h-10 rounded-none border border-stone-300 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wider ring-offset-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900">
                        <option value="expense">Expense</option>
                        <option value="income">Income</option>
                      </select>
                    </div>
                     <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Category</Label>
                      <Input value={txForm.category} list="cat-list-inline" onChange={e => setTxForm({...txForm, category: e.target.value})} className="mt-1.5 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" placeholder="e.g. Food" />
                      <datalist id="cat-list-inline">
                         {categories.map(c => <option key={c.id} value={c.name} />)}
                      </datalist>
                    </div>
                    <Button onClick={handleSaveTransaction} className="w-full mt-4 rounded-none bg-stone-950 hover:bg-stone-800 text-white font-bold uppercase tracking-widest text-xs h-10">
                      Save Transaction
                    </Button>
                  </div>
                </div>
                
                {/* Transaction List */}
                <div className="lg:col-span-2 bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] flex flex-col overflow-hidden">
                  <div className="p-4 border-b-2 border-stone-900 bg-stone-50 flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1 block">From Date</Label>
                      <Input type="date" value={txFilters.dateFrom} onChange={e => setTxFilters(prev => ({...prev, dateFrom: e.target.value}))} className="h-8 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-xs w-full" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1 block">To Date</Label>
                      <Input type="date" value={txFilters.dateTo} onChange={e => setTxFilters(prev => ({...prev, dateTo: e.target.value}))} className="h-8 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-xs w-full" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1 block">Category</Label>
                      <select value={txFilters.category} onChange={e => setTxFilters(prev => ({...prev, category: e.target.value}))} className="flex w-full h-8 rounded-none border border-stone-300 bg-white px-2 py-1 text-xs font-mono uppercase tracking-wider ring-offset-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900">
                        <option value="all">All Categories</option>
                        {uniqueTxCategories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <Label className="text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1 block">Type</Label>
                      <select value={txFilters.type} onChange={e => setTxFilters(prev => ({...prev, type: e.target.value}))} className="flex w-full h-8 rounded-none border border-stone-300 bg-white px-2 py-1 text-xs font-mono uppercase tracking-wider ring-offset-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900">
                        <option value="all">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="p-0 overflow-auto flex-1">
                    <Table>
                      <TableHeader className="bg-white sticky top-0 cursor-default">
                        <TableRow className="border-b-2 border-stone-900 hover:bg-transparent">
                          <TableHead className="text-xs border-r-2 border-stone-900 font-bold tracking-wider text-stone-900 uppercase font-mono">Date</TableHead>
                          <TableHead className="text-xs border-r-2 border-stone-900 font-bold tracking-wider text-stone-900 uppercase font-mono">Description</TableHead>
                          <TableHead className="text-xs border-r-2 border-stone-900 font-bold tracking-wider text-stone-900 uppercase font-mono">Category</TableHead>
                          <TableHead className="text-right text-xs font-bold tracking-wider text-stone-900 uppercase font-mono">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="h-24 text-center text-stone-500 font-mono text-sm">No transactions found.</TableCell>
                          </TableRow>
                        ) : filteredTransactions.map((tx) => (
                          <TableRow key={tx.id} className="border-b border-stone-300 hover:bg-stone-50 transition-colors">
                            <TableCell className="text-stone-500 border-r border-stone-300 whitespace-nowrap font-mono text-xs">{tx.date}</TableCell>
                            <TableCell className="font-semibold border-r border-stone-300 text-stone-800 text-sm">{tx.desc}</TableCell>
                            <TableCell className="border-r border-stone-300">
                              <span className="inline-flex items-center px-2 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest bg-stone-100 text-stone-600 border border-stone-200">
                                {tx.category}
                              </span>
                            </TableCell>
                            <TableCell className={cn(
                              "text-right font-mono font-medium whitespace-nowrap text-sm",
                              tx.type === 'income' ? 'text-stone-900' : 'text-stone-500'
                            )}>
                              {tx.type === 'income' ? '' : '-'}IDR {Math.abs(tx.amount).toLocaleString('id-ID')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </div>
          } />

          <Route path="/budgets" element={
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="flex items-center justify-between border-b-2 border-stone-900 pb-4">
                <h2 className="text-xl font-bold font-mono tracking-widest text-stone-900 uppercase">Budgets & Categories</h2>
              </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Categories Manager */}
                 <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] p-6">
                    <h3 className="text-xs font-bold font-mono tracking-widest text-stone-500 uppercase mb-6 flex items-center gap-2"><LayoutList className="w-4 h-4"/> Custom Categories</h3>
                    
                    <form 
                      className="flex gap-2 mb-6" 
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const name = (form.elements.namedItem('catName') as HTMLInputElement).value;
                        const type = (form.elements.namedItem('catType') as HTMLSelectElement).value;
                        if (!name || !user) return;
                        try {
                          await addDoc(collection(db, 'categories'), {
                            userId: user.uid,
                            name, type, createdAt: Date.now()
                          });
                          form.reset();
                        } catch (err) {
                          handleFirestoreError(err, OperationType.CREATE, 'categories', auth);
                        }
                      }}
                    >
                       <Input name="catName" placeholder="New Category..." required className="flex-1 rounded-none border-stone-300 font-mono text-sm" />
                       <select name="catType" className="rounded-none border border-stone-300 bg-white px-3 py-2 text-xs font-mono uppercase tracking-wider outline-none">
                         <option value="expense">Exp</option>
                         <option value="income">Inc</option>
                       </select>
                       <Button type="submit" className="rounded-none bg-stone-950 px-4 text-xs font-bold uppercase tracking-widest">Add</Button>
                    </form>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                       {categories.map(c => (
                         <div key={c.id} className="flex items-center justify-between p-3 border border-stone-200 bg-stone-50 group">
                            <div className="flex items-center gap-2">
                               <span className={cn("w-2 h-2 rounded-full", c.type === 'income' ? "bg-stone-900" : "bg-stone-400")}></span>
                               <span className="font-mono text-sm font-bold">{c.name}</span>
                            </div>
                            <button 
                               onClick={() => deleteDoc(doc(db, 'categories', c.id)).catch(e => handleFirestoreError(e, OperationType.DELETE, 'categories', auth))}
                               className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-500 transition-opacity"
                            >
                               <Trash2 className="w-4 h-4" />
                            </button>
                         </div>
                       ))}
                       {categories.length === 0 && <p className="text-xs font-mono text-stone-500 text-center py-4">No custom categories.</p>}
                    </div>
                 </div>

                 {/* Budget Manager */}
                 <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] p-6 flex flex-col">
                    <h3 className="text-xs font-bold font-mono tracking-widest text-stone-500 uppercase mb-6 flex items-center gap-2"><PieChart className="w-4 h-4"/> Set Budget Targets</h3>
                    
                    <form 
                      className="space-y-4 mb-6"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const categoryName = (form.elements.namedItem('bCategory') as HTMLInputElement).value;
                        const amount = (form.elements.namedItem('bAmount') as HTMLInputElement).value;
                        if (!categoryName || !amount || !user) return;
                        
                        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                        try {
                           // Check if already exists
                           const qb = query(collection(db, 'budgets'), where('userId', '==', user.uid), where('category', '==', categoryName), where('month', '==', currentMonth));
                           const snaps = await getDocs(qb);
                           if (!snaps.empty) {
                             await updateDoc(doc(db, 'budgets', snaps.docs[0].id), { amount: Number(amount) });
                           } else {
                             await addDoc(collection(db, 'budgets'), {
                               userId: user.uid,
                               category: categoryName,
                               amount: Number(amount),
                               month: currentMonth,
                               createdAt: Date.now()
                             });
                           }
                           form.reset();
                        } catch (err) {
                           handleFirestoreError(err, OperationType.CREATE, 'budgets', auth);
                        }
                      }}
                    >
                       <div>
                         <Label className="text-xs font-bold uppercase text-stone-500">Category</Label>
                         <Input name="bCategory" placeholder="e.g. Food" required className="mt-1.5 rounded-none border-stone-300 font-mono text-sm" list="category-options" />
                         <datalist id="category-options">
                           {categories.map(c => <option key={c.id} value={c.name} />)}
                         </datalist>
                       </div>
                       <div>
                         <Label className="text-xs font-bold uppercase text-stone-500">Target Limit</Label>
                         <Input name="bAmount" type="number" placeholder="500000" required className="mt-1.5 rounded-none border-stone-300 font-mono text-sm" />
                       </div>
                       <Button type="submit" className="w-full rounded-none bg-stone-950 font-bold uppercase tracking-widest text-xs">Set / Update Budget</Button>
                    </form>

                    <div className="flex-1 space-y-4 overflow-y-auto">
                       {budgets.map(b => {
                           const currentMonth = new Date().toISOString().slice(0, 7);
                           if (b.month !== currentMonth) return null; // Simple filter for UI
                           
                           // Calculate spent for this category
                           const spent = transactions
                             .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase() && t.date.startsWith(currentMonth))
                             .reduce((acc, t) => acc + Math.abs(t.amount), 0);
                             
                           const pct = Math.min(100, Math.round((spent / b.amount) * 100)) || 0;
                           const isOver = spent > b.amount;

                           return (
                             <div key={b.id} className="p-3 border border-stone-200 bg-stone-50">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-bold font-mono text-sm uppercase tracking-wider">{b.category}</span>
                                  <span className="text-xs font-mono font-bold">{pct}%</span>
                                </div>
                                <div className="h-2 w-full bg-stone-200 mb-2">
                                   <div className={cn("h-full", isOver ? "bg-red-500" : "bg-stone-900")} style={{ width: `${pct}%` }}></div>
                                </div>
                                <div className="flex items-center justify-between text-[10px] uppercase font-bold text-stone-500 tracking-widest">
                                   <span>Sp: IDR {spent.toLocaleString()}</span>
                                   <span>Bud: IDR {b.amount.toLocaleString()}</span>
                                </div>
                             </div>
                           )
                       })}
                       {budgets.length === 0 && <p className="text-xs font-mono text-stone-500 text-center py-4">No active budgets.</p>}
                    </div>
                 </div>
               </div>
            </div>
            } />

          <Route path="/reminders" element={
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between border-b-2 border-stone-900 pb-4">
                <h2 className="text-xl font-bold font-mono tracking-widest text-stone-900 uppercase">Upcoming Reminders</h2>
                <Button onClick={() => handleOpenAddReminder()} className="rounded-none bg-stone-950 hover:bg-stone-800 text-white font-bold uppercase tracking-widest text-xs px-6">
                   Add Reminder
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reminders.map(reminder => (
                   <div 
                     key={reminder.id} 
                     onClick={() => handleOpenEditReminder(reminder)}
                     className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] p-6 flex flex-col group relative overflow-hidden cursor-pointer hover:shadow-[8px_8px_0_0_rgba(28,25,23,1)] hover:-translate-y-1 transition-all"
                   >
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 bg-stone-100 border border-stone-200 flex items-center justify-center rounded-sm">
                           <Bell className="w-5 h-5 text-stone-900" />
                        </div>
                        <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-1 uppercase font-bold tracking-widest border border-amber-200">
                           {reminder.frequency}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-stone-900 mb-1 font-sans pr-16">{reminder.title}</h3>
                      <p className="font-mono text-2xl text-stone-900 mb-8 font-medium">IDR {reminder.amount.toLocaleString('id-ID')}</p>
                      <div className="mt-auto pt-4 border-t border-stone-100 flex items-center justify-between">
                        <div className="text-[11px] font-bold font-mono uppercase tracking-widest text-stone-400">
                           Next due: <span className="text-stone-900">{reminder.nextDate.toLocaleDateString()}</span>
                        </div>
                        <span className="w-2 h-2 rounded-none bg-amber-500 animate-pulse"></span>
                      </div>
                   </div>
                ))}
              </div>
            </div>
          } />

          <Route path="/settings" element={
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b-2 border-stone-900 pb-4">
                <h2 className="text-xl font-bold font-mono tracking-widest text-stone-900 uppercase">Settings</h2>
              </div>
              
              <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] p-8 space-y-10">
                 <div>
                   <h3 className="text-sm font-bold font-mono tracking-widest text-stone-400 uppercase mb-6 pb-2 border-b border-stone-100">Profile Configuration</h3>
                   <div className="space-y-6">
                      <div className="max-w-md">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Full Name</Label>
                        <Input className="mt-1.5 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" defaultValue="John Doe" />
                      </div>
                      <div className="max-w-md">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Email Address</Label>
                        <Input className="mt-1.5 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" defaultValue="johndoe@example.com" />
                      </div>
                   </div>
                 </div>

                 <div className="pt-6 border-t border-stone-100 flex justify-end">
                    <Button className="rounded-none bg-stone-950 hover:bg-stone-800 text-white font-bold uppercase tracking-widest text-xs px-8 h-10">
                      Save All Changes
                    </Button>
                 </div>
              </div>
            </div>
          } />

          <Route path="/guide" element={
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="border-b-2 border-stone-900 pb-4">
                <h2 className="text-xl font-bold font-mono tracking-widest text-stone-900 uppercase">AI / Telegram Bot Guide</h2>
              </div>
              
              <div className="bg-white border-2 border-stone-900 shadow-[4px_4px_0_0_rgba(28,25,23,1)] p-8 space-y-10">
                 <div>
                   <h3 className="text-sm font-bold font-mono tracking-widest text-stone-400 uppercase mb-6 pb-2 border-b border-stone-100 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4"/> Hubungkan Telegram Anda
                   </h3>
                    <div className="space-y-6">
                      <div className="max-w-md">
                        <Label className="text-xs font-bold uppercase tracking-wider text-stone-500">Telegram Chat ID</Label>
                        <div className="flex gap-2 mt-1.5">
                           <Input 
                             value={telegramChatId}
                             onChange={(e) => setTelegramChatId(e.target.value)}
                             className="rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" 
                             placeholder="e.g., 123456789" 
                           />
                           <Button 
                             onClick={handleVerifyTelegram}
                             disabled={verificationStatus.loading || !telegramChatId}
                             className="rounded-none bg-stone-100 border border-stone-300 hover:bg-stone-200 text-stone-900 font-bold uppercase tracking-widest text-xs px-6"
                           >
                             {verificationStatus.loading ? 'Verifying...' : 'Verify'}
                           </Button>
                        </div>
                        {verificationStatus.message && (
                          <p className={cn("text-xs font-bold mt-2", verificationStatus.success ? "text-green-600" : "text-amber-600")}>
                            {verificationStatus.message}
                          </p>
                        )}
                        <p className="text-[10px] text-stone-400 font-mono mt-3 uppercase tracking-wider leading-relaxed">
                          Dapatkan Chat ID Anda dengan mengirimkan pesan <code className="bg-stone-200 px-1 py-0.5 text-stone-800">/start</code> ke bot telegram <a href="https://t.me/Rsven_7_bot" target="_blank" rel="noreferrer" className="text-stone-900 font-bold underline">@Rsven_7_bot</a>
                        </p>
                      </div>
                   </div>
                 </div>

                 <div>
                    <h3 className="text-sm font-bold font-mono tracking-widest text-stone-400 uppercase mb-6 pb-2 border-b border-stone-100 flex items-center gap-2">
                       <LayoutList className="w-4 h-4"/> Panduan Cara Menggunakan
                    </h3>
                    <div className="space-y-6">
                       <p className="text-xs text-stone-500 font-mono mb-2">Setelah terhubung dengan bot, Anda dapat mencatat transaksi langsung ke aplikasi ini melalui 3 cara super mudah:</p>
                       
                       <div className="border border-stone-200 bg-stone-50 p-6 space-y-6">
                          <div>
                            <h4 className="flex items-center gap-2 text-sm font-bold text-stone-900 font-mono uppercase tracking-widest mb-2">
                               <span className="text-lg">💬</span> Input Teks Manual
                            </h4>
                            <p className="text-[11px] text-stone-500 font-mono mb-2 leading-relaxed">Cukup kirimkan pesan teks biasa dengan format nominal dan deskripsi. Bot akan otomatis memahami.</p>
                            <code className="block bg-stone-200 text-stone-800 p-3 text-xs font-bold border border-stone-300 shadow-sm">50000 Nasi Goreng Extra Pedas</code>
                          </div>

                          <div className="border-t border-stone-200 pt-6">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-stone-900 font-mono uppercase tracking-widest mb-2">
                               <span className="text-lg">📸</span> Scan Struk/Kwitansi (AI OCR)
                            </h4>
                            <p className="text-[11px] text-stone-500 font-mono leading-relaxed">Punya struk belanja makan atau swalayan? Kirimkan fotonya ke bot. AI canggih akan membaca foto (Receipt OCR) dan otomatis input total belanja beserta kategorinya tanpa Anda perlu mengetik apapun!</p>
                          </div>

                          <div className="border-t border-stone-200 pt-6">
                            <h4 className="flex items-center gap-2 text-sm font-bold text-stone-900 font-mono uppercase tracking-widest mb-2">
                               <span className="text-lg">🎤</span> Input Suara (Voice Note AI)
                            </h4>
                            <p className="text-[11px] text-stone-500 font-mono mb-3 leading-relaxed">Sedang menyetir mobil atau malas mengetik? Kirim pesan suara (Voice Note) berbahasa Indonesia menggunakan bahasa sehari-hari. AI akan memprosesnya dalam hitungan detik.</p>
                            <div className="flex gap-2 items-center">
                              <span className="bg-stone-300 text-stone-600 w-8 h-8 flex items-center justify-center rounded-full text-xs shadow-sm">▶</span>
                              <code className="flex items-center bg-stone-200 text-stone-800 p-2 px-4 text-[11px] font-bold rounded-full border border-stone-300 shadow-sm italic">"hari ini habis seratus dua puluh ribu buat makan siang sama temen kantor"</code>
                            </div>
                          </div>
                       </div>
                    </div>
                 </div>

              </div>
            </div>
          } />
          </Routes>

        </div>
        <Dialog open={isReminderOpen} onOpenChange={setIsReminderOpen}>
          <DialogContent className="sm:max-w-[425px] rounded-none border border-stone-900 shadow-2xl p-0 overflow-hidden">
            <DialogHeader className="bg-stone-950 p-6 text-stone-50">
              <DialogTitle className="font-mono uppercase tracking-widest text-sm">{editingReminder ? 'Edit Reminder' : 'Add Reminder'}</DialogTitle>
              <DialogDescription className="text-stone-400 text-xs font-mono mt-2">
                Set a new bill or reminder for: <span className="text-stone-50">{selectedDate?.toLocaleDateString()}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 p-6 bg-white">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right text-xs font-bold uppercase tracking-wider text-stone-500">
                  Title
                </Label>
                <Input 
                  id="title" 
                  value={reminderForm.title}
                  onChange={(e) => setReminderForm({ ...reminderForm, title: e.target.value })}
                  placeholder="e.g., Netflix Bill" 
                  className="col-span-3 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="amount" className="text-right text-xs font-bold uppercase tracking-wider text-stone-500">
                  Amount
                </Label>
                <Input 
                  id="amount" 
                  type="number" 
                  value={reminderForm.amount}
                  onChange={(e) => setReminderForm({ ...reminderForm, amount: e.target.value })}
                  placeholder="150000" 
                  className="col-span-3 rounded-none border-stone-300 focus-visible:ring-stone-900 font-mono text-sm" 
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="frequency" className="text-right text-xs font-bold uppercase tracking-wider text-stone-500">
                  Period
                </Label>
                <select 
                  id="frequency"
                  value={reminderForm.frequency}
                  onChange={(e) => setReminderForm({ ...reminderForm, frequency: e.target.value })}
                  className="col-span-3 flex h-10 w-full rounded-none border border-stone-300 bg-white px-3 py-2 text-sm font-mono uppercase tracking-wider ring-offset-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
                >
                  <option value="once">Once</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <DialogFooter className="bg-stone-50 p-6 border-t border-stone-200 flex flex-row items-center w-full">
              {editingReminder && (
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => { handleDeleteReminder(editingReminder.id); setIsReminderOpen(false); }} 
                  className="mr-auto rounded-none border border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 font-bold uppercase tracking-widest text-xs px-6"
                >
                  Delete
                </Button>
              )}
              <Button type="submit" onClick={handleSaveReminder} className="ml-auto rounded-none bg-stone-950 hover:bg-stone-800 text-white font-bold uppercase tracking-widest text-xs px-6">
                {editingReminder ? 'Save Changes' : 'Save Reminder'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}

// -- Utility Components --

function NavItem({ icon, label, active = false, onClick, to }: { icon: React.ReactNode, label: string, active?: boolean, onClick?: () => void, to?: string }) {
  const content = (
    <div className={cn(
      "flex items-center gap-4 px-4 py-3 w-full text-left font-bold text-xs uppercase tracking-widest rounded-none border-l-2 transition-colors",
      active 
        ? "bg-stone-900 text-stone-50 border-amber-600" 
        : "text-stone-400 border-transparent hover:bg-stone-900 hover:text-stone-200"
    )}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4' })}
      <span>{label}</span>
    </div>
  );
  
  if (to) {
    return <Link to={to} className="block w-full">{content}</Link>;
  }

  return (
    <button onClick={onClick} className="w-full">
      {content}
    </button>
  );
}

function StatCard({ 
  title, amount, trend, isPositive, icon, iconColor 
}: { 
  title: string, amount: string, trend: string, isPositive: boolean, icon?: React.ReactNode, iconColor?: string 
}) {
  return (
    <div className="bg-white p-6 rounded-none border border-stone-300 flex flex-col relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
        {icon && React.cloneElement(icon as React.ReactElement, { className: 'w-24 h-24 -mr-8 -mt-8' })}
      </div>
      <div className="flex items-center justify-between text-stone-500 mb-4 relative z-10">
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">{title}</span>
        {icon && <div className={cn("p-1.5 bg-stone-100 rounded-sm border border-stone-200", iconColor)}>{icon}</div>}
      </div>
      <div className="font-mono font-medium text-2xl text-stone-900 mb-1 tracking-tight relative z-10">{amount}</div>
      <div className="flex items-center gap-2 mt-auto relative z-10">
        <span className={cn("font-bold text-xs bg-stone-100 px-1.5 py-0.5 rounded-none border", isPositive ? "text-stone-900 border-stone-300" : "text-stone-500 border-stone-200")}>
          {trend}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">vs last month</span>
      </div>
    </div>
  );
}
