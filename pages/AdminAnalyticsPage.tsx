import * as React from 'react';
import { useData } from '../context/DataContext';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { UserGroupIcon, ChartBarIcon, ClockIcon } from '../components/icons';

const StatCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
    <div className="bg-white p-6 rounded-lg shadow-md flex items-center space-x-4 space-x-reverse">
        <div className="bg-blue-100 text-blue-600 rounded-full p-3">{icon}</div>
        <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold text-gray-800">{value}</p>
        </div>
    </div>
);

const CustomTooltip = ({ active, payload, label, formatter }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 border shadow-lg rounded-md text-sm">
                <p className="font-bold mb-1">{label}</p>
                {payload.map((pld: any, index: number) => (
                    <p key={index} style={{ color: pld.color }}>
                        {`${pld.name}: ${formatter ? formatter(pld.value) : pld.value}`}
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const AdminAnalyticsPage: React.FC = () => {
    const { profiles, clients, adminTasks, isDataLoading: loading } = useData();
    const [stats, setStats] = React.useState<any>(null);
    const [error, setError] = React.useState<string | null>(null);

    React.useEffect(() => {
        if (loading) return;

        try {
            const today = new Date();
            const activeSubscriptions = profiles.filter(p => p.subscription_end_date && new Date(p.subscription_end_date) >= today).length;
            const pendingApprovals = profiles.filter(p => !p.is_approved).length;

            const allCases = clients.flatMap(c => c.cases);
            const caseStatusCounts = allCases.reduce((acc, c) => {
                acc[c.status] = (acc[c.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            const caseStatusData = [
                { name: 'نشطة', value: caseStatusCounts.active || 0 },
                { name: 'مغلقة', value: caseStatusCounts.closed || 0 },
                { name: 'معلقة', value: caseStatusCounts.on_hold || 0 },
            ];
            
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            const userSignups = profiles
                .filter(p => p.created_at && new Date(p.created_at) >= thirtyDaysAgo)
                .reduce((acc, p) => {
                    const dateStr = new Date(p.created_at!).toLocaleDateString('en-CA'); // YYYY-MM-DD
                    acc[dateStr] = (acc[dateStr] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);

            const userSignupsData = Object.entries(userSignups)
                .map(([date, count]) => ({ date, "مستخدمين جدد": count }))
                .sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

            const activityByUser = profiles.map(p => {
                const clientCount = clients.filter(c => (c as any).user_id === p.id).length;
                const caseCount = allCases.filter(c => (c as any).user_id === p.id).length;
                const taskCount = adminTasks.filter(t => (t as any).user_id === p.id).length;
                return { name: p.full_name, "عدد الإدخالات": clientCount + caseCount + taskCount };
            }).sort((a, b) => b["عدد الإدخالات"] - a["عدد الإدخالات"]).slice(0, 10);

            setStats({
                totalUsers: profiles.length,
                activeSubscriptions,
                pendingApprovals,
                caseStatusData,
                userSignupsData,
                activityByUser
            });

        } catch (err: any) {
            setError(err.message);
        }
    }, [loading, profiles, clients, adminTasks]);

    if (loading) return <div className="text-center p-8">جاري تحميل التحليلات...</div>;
    if (error) return <div className="p-4 text-red-700 bg-red-100 rounded-md">{error}</div>;
    if (!stats) return <div className="text-center p-8">لا توجد بيانات كافية لعرض التحليلات.</div>;

    const PIE_COLORS = ['#10B981', '#F59E0B', '#6B7280'];
    
    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800">لوحة التحكم والتحليلات</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="إجمالي المستخدمين" value={stats.totalUsers} icon={<UserGroupIcon className="w-6 h-6" />} />
                <StatCard title="الاشتراكات النشطة" value={stats.activeSubscriptions} icon={<ChartBarIcon className="w-6 h-6" />} />
                <StatCard title="الطلبات المعلقة" value={stats.pendingApprovals} icon={<ClockIcon className="w-6 h-6" />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="font-bold mb-4 text-center text-gray-700">نمو المستخدمين (آخر 30 يوم)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={stats.userSignupsData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis allowDecimals={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            <Line type="monotone" dataKey="مستخدمين جدد" stroke="#3B82F6" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                 <div className="bg-white p-6 rounded-lg shadow-md">
                    <h3 className="font-bold mb-4 text-center text-gray-700">توزيع حالات القضايا</h3>
                    <ResponsiveContainer width="100%" height={300}>
                         <PieChart>
                            <Pie data={stats.caseStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                                {stats.caseStatusData.map((_entry: any, index: number) => <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

             <div className="bg-white p-6 rounded-lg shadow-md">
                <h3 className="font-bold mb-4 text-center text-gray-700">أكثر المستخدمين نشاطاً (حسب عدد الإدخالات)</h3>
                 <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={stats.activityByUser} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="عدد الإدخالات" fill="#8884d8" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default AdminAnalyticsPage;