import React from 'react';

export default function AdminDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-50 p-8 font-sans">
      {/* Top Navbar */}
      <header className="flex items-center justify-between pb-8 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-extrabold text-xl shadow-md">
            S
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">SafarGo Operations</h1>
            <p className="text-xs text-slate-500 font-medium">Enterprise Control Center • Platform v1.0.0</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            System Live
          </span>
          <div className="w-9 h-9 rounded-full bg-slate-200 border border-slate-300 flex items-center justify-center font-bold text-slate-700 text-sm">
            AD
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mt-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Users</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">1,428</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">↑ 14% this week</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Drivers</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">386</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">Active on road</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Today's Rides</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">612</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">98.4% completion</p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">OTP Verification</p>
            <p className="text-3xl font-extrabold text-slate-900 mt-2">99.8%</p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">Resend API live</p>
          </div>
        </div>

        {/* Status Section */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Architecture Foundation Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">Customer Mobile App</span>
              <span className="text-slate-500">React Native • Expo Router • Reanimated • Zustand</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">Backend Engine</span>
              <span className="text-slate-500">NestJS • Node.js • Prisma ORM • PostgreSQL • Resend</span>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <span className="font-bold text-slate-800 block mb-1">Security & Validation</span>
              <span className="text-slate-500">Shared Zod Schemas • SHA-256 OTP Digest • Bcrypt</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
