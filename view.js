const app = {
    currentTab: 'dashboard',
    
    init() {
        const now = new Date();
        document.getElementById('modal-date').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        viewRenderer.updateAll();
        this.switchTab('dashboard');
    },

    switchTab(tab) {
        this.currentTab = tab;
        const views = ['dashboard', 'history', 'rebalance', 'analysis', 'magic', 'fire', 'simulator'];
        const uploadDiv = document.getElementById('upload-section');
        const hasData = dataManager.transactions.length > 0;

        views.forEach(v => {
            const el = document.getElementById(`view-${v}`);
            const btn = document.getElementById(`nav-${v}`);
            
            if(v === tab) {
                if(!hasData && tab === 'dashboard') {
                    el.classList.add('hidden');
                    uploadDiv.classList.remove('hidden');
                } else {
                    el.classList.remove('hidden');
                    uploadDiv.classList.add('hidden');
                }
                if(btn) btn.classList.add('active');
                this.updateHeader(tab);
            } else {
                el.classList.add('hidden');
                if(btn) btn.classList.remove('active');
            }
        });

        if(tab === 'history') viewRenderer.renderHistory();
        if(tab === 'rebalance') viewRenderer.renderRebalance();
        if(tab === 'analysis') viewRenderer.renderAnalysis();
        if(tab === 'magic') viewRenderer.renderMagic();
        if(tab === 'fire') viewRenderer.renderFire();
        if(tab === 'simulator') setTimeout(() => viewRenderer.renderSimulation(), 100);
    },

    updateHeader(tab) {
        const titles = {
            dashboard: "Visão Geral", history: "Histórico Detalhado", rebalance: "Aporte Inteligente",
            analysis: "Raio-X da Carteira", magic: "Número Mágico", fire: "Metas FIRE", simulator: "Simulador de Futuro"
        };
        document.getElementById('page-title').innerText = titles[tab] || "TijoloHub";
    },

    openModal(id = null) {
        document.getElementById('modal-id').value = id || "";
        if(id) {
            const tx = dataManager.transactions.find(t => t.id === id);
            if(tx) {
                document.getElementById('modal-date').value = tx.date;
                document.getElementById('modal-ticker').value = tx.ticker;
                document.getElementById('modal-qtd').value = tx.qtd;
                document.getElementById('modal-pm').value = tx.price;
                document.getElementById('modal-div').value = tx.dividend;
                document.getElementById('modal-sector').value = tx.sector;
                document.getElementById('modal-title').innerText = "Editar Aporte";
            }
        } else {
            document.getElementById('asset-form').reset();
            const now = new Date();
            document.getElementById('modal-date').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
            document.getElementById('modal-title').innerText = "Novo Aporte";
        }
        document.getElementById('asset-modal').classList.remove('hidden');
    },

    closeModal() { document.getElementById('asset-modal').classList.add('hidden'); }
};

const viewRenderer = {
    charts: {},

    updateAll() {
        if(dataManager.transactions.length === 0) return;
        this.renderDashboard();
        this.renderGamification();
        if(app.currentTab === 'history') this.renderHistory();
    },

    renderDashboard() {
        const portfolio = dataManager.getConsolidatedPortfolio();
        let totalInvested = 0, totalCurrent = 0, monthlyIncome = 0;
        const tbody = document.getElementById('assets-table-body');
        if(tbody) tbody.innerHTML = '';

        portfolio.forEach(p => {
            totalInvested += p.invested;
            totalCurrent += p.totalCurrent;
            monthlyIncome += p.monthlyIncome;
            if(tbody) {
                tbody.innerHTML += `
                    <tr class="hover:bg-slate-800/50 border-b border-slate-800/50 group">
                        <td class="p-4 pl-6 flex items-center gap-3">
                            <div class="w-8 h-8 bg-slate-800 rounded flex items-center justify-center text-xs font-bold border border-slate-700 group-hover:border-sky-500 transition-colors">${p.ticker.substring(0,2)}</div>
                            <span class="font-bold text-white">${p.ticker}</span>
                        </td>
                        <td class="p-4 text-right">${p.qtd}</td>
                        <td class="p-4 text-right text-slate-400">R$ ${p.pm.toFixed(2)}</td>
                        <td class="p-4 text-right text-yellow-500">R$ ${p.div.toFixed(2)}</td>
                        <td class="p-4 text-right pr-6 font-bold text-white">${dataManager.formatMoney(p.invested)}</td>
                    </tr>`;
            }
        });

        document.getElementById('total-invested').innerText = dataManager.formatMoney(totalInvested);
        document.getElementById('current-value').innerText = dataManager.formatMoney(totalCurrent);
        const profit = totalCurrent - totalInvested;
        const profitEl = document.getElementById('total-profit');
        profitEl.innerText = dataManager.formatMoney(profit);
        profitEl.className = `text-2xl font-bold ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`;
        
        const pctEl = document.getElementById('profit-percent');
        pctEl.innerText = (totalInvested > 0 ? ((profit/totalInvested)*100).toFixed(2) : 0) + '%';
        pctEl.className = `text-xs font-bold px-2 py-0.5 rounded mt-2 inline-block ${profit >= 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`;

        document.getElementById('monthly-yield').innerText = dataManager.formatMoney(monthlyIncome);
        document.getElementById('header-income').innerText = dataManager.formatMoney(monthlyIncome);
        document.getElementById('avg-dy').innerText = (totalCurrent > 0 ? ((monthlyIncome/totalCurrent)*100).toFixed(2) : 0) + '%';

        this.renderCharts(portfolio);
    },

    renderCharts(portfolio) {
        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = '#334155';

        const ctxAlloc = document.getElementById('allocationChart');
        if(this.charts.alloc) this.charts.alloc.destroy();
        this.charts.alloc = new Chart(ctxAlloc, {
            type: 'doughnut',
            data: {
                labels: portfolio.map(p => p.ticker),
                datasets: [{ data: portfolio.map(p => p.totalCurrent), backgroundColor: dataManager.getColors(portfolio.length), borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }
        });

        const sectorData = {};
        portfolio.forEach(p => { sectorData[p.sector] = (sectorData[p.sector] || 0) + p.totalCurrent; });
        const ctxSector = document.getElementById('sectorChart');
        if(this.charts.sector) this.charts.sector.destroy();
        this.charts.sector = new Chart(ctxSector, {
            type: 'pie',
            data: {
                labels: Object.keys(sectorData),
                datasets: [{ data: Object.values(sectorData), backgroundColor: dataManager.getColors(Object.keys(sectorData).length).reverse(), borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { boxWidth: 10 } } } }
        });

        const timeline = {}; 
        dataManager.transactions.forEach(t => { 
            if(!timeline[t.date]) timeline[t.date] = { invested: 0, income: 0 };
            timeline[t.date].invested += (t.qtd * t.price);
            timeline[t.date].income += (t.qtd * t.dividend);
        });
        
        const dates = Object.keys(timeline).sort();
        let accInv = 0;
        const invData = dates.map(d => { accInv += timeline[d].invested; return accInv; });
        const incData = dates.map(d => timeline[d].income);

        const ctxHist = document.getElementById('historyPatrimonyChart');
        if(this.charts.hist) this.charts.hist.destroy();
        this.charts.hist = new Chart(ctxHist, {
            type: 'line',
            data: { labels: dates, datasets: [{ label: 'Investido', data: invData, borderColor: '#0ea5e9', tension: 0.4, fill: true, backgroundColor: 'rgba(14, 165, 233, 0.1)' }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#1e293b' } } } }
        });

        const ctxDiv = document.getElementById('historyDividendsChart');
        if(this.charts.div) this.charts.div.destroy();
        this.charts.div = new Chart(ctxDiv, {
            type: 'bar',
            data: { labels: dates, datasets: [{ label: 'Proventos', data: incData, backgroundColor: '#eab308', borderRadius: 4 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: '#1e293b' } } } }
        });
    },

    renderHistory() {
        const container = document.getElementById('history-container');
        container.innerHTML = '';
        const groups = {};
        
        dataManager.transactions.forEach(t => { 
            if(!groups[t.date]) groups[t.date] = []; 
            groups[t.date].push(t); 
        });
        
        Object.keys(groups).sort().reverse().forEach(date => {
            const total = groups[date].reduce((a,b) => a + (b.qtd*b.price), 0);
            let html = `
                <div class="mb-8 animate-fade-in">
                    <div class="flex items-center gap-4 mb-4">
                        <span class="bg-slate-800 px-4 py-1 rounded-full text-sm font-bold border border-slate-700 text-white">${date}</span>
                        <div class="h-px bg-slate-800 flex-1"></div>
                        <span class="text-xs text-slate-500 font-mono uppercase">Aporte Total: <span class="text-white font-bold">${dataManager.formatMoney(total)}</span></span>
                    </div>`;
            
            groups[date].forEach(t => {
                html += `
                <div class="card-glass p-4 flex justify-between items-center mb-3 hover:bg-slate-800/60 group transition-all border-l-4 border-transparent hover:border-sky-500">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center font-bold text-xs border border-slate-700 text-slate-300">${t.ticker.substring(0,2)}</div>
                        <div><p class="font-bold text-white">${t.ticker}</p><p class="text-xs text-slate-400">${t.qtd} cotas • ${t.sector}</p></div>
                    </div>
                    <div class="text-right flex items-center gap-6">
                        <div><p class="text-xs text-slate-500">Valor</p><p class="text-white font-mono font-bold">${dataManager.formatMoney(t.qtd*t.price)}</p></div>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onclick="app.openModal('${t.id}')" class="p-2 rounded bg-slate-800 hover:bg-sky-600 text-slate-400 hover:text-white transition-colors"><i class="ph ph-pencil-simple"></i></button>
                            <button onclick="dataManager.deleteTransaction('${t.id}')" class="p-2 rounded bg-slate-800 hover:bg-red-600 text-slate-400 hover:text-white transition-colors"><i class="ph ph-trash"></i></button>
                        </div>
                    </div>
                </div>`;
            });
            container.innerHTML += html + '</div>';
        });
    },

    renderRebalance() {
        const amount = parseFloat(document.getElementById('rebalance-amount').value) || 0;
        const portfolio = dataManager.getConsolidatedPortfolio();
        const total = portfolio.reduce((a,b) => a + b.totalCurrent, 0) + amount;
        const grid = document.getElementById('rebalance-grid');
        grid.innerHTML = '';
        
        if(Object.keys(dataManager.targetWeights).length === 0) portfolio.forEach(p => dataManager.targetWeights[p.ticker] = 100/portfolio.length);

        portfolio.forEach(p => { p.diff = (total * ((dataManager.targetWeights[p.ticker]||0)/100)) - p.totalCurrent; });
        portfolio.sort((a,b) => b.diff - a.diff).forEach(p => {
            const buy = Math.max(0, Math.floor(p.diff / p.currentPrice));
            grid.innerHTML += `
            <div class="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-800/30 border-b border-slate-800/30">
                <div class="col-span-4 flex gap-3 items-center"><div class="w-8 h-8 bg-slate-800 rounded flex justify-center items-center text-xs font-bold">${p.ticker.substring(0,2)}</div><span class="font-bold text-white">${p.ticker}</span></div>
                <div class="col-span-2 text-right text-slate-400 text-sm">${((p.totalCurrent/(total-amount))*100).toFixed(1)}%</div>
                <div class="col-span-2 text-right"><input type="number" value="${(dataManager.targetWeights[p.ticker]||0).toFixed(0)}" onchange="dataManager.targetWeights['${p.ticker}']=parseFloat(this.value);dataManager.saveData();viewRenderer.renderRebalance()" class="w-12 bg-slate-900 border border-slate-700 text-center text-xs py-1 rounded text-white outline-none focus:border-sky-500"> %</div>
                <div class="col-span-2 text-right text-sm ${p.diff>0?'text-yellow-400':'text-green-400'}">${p.diff>0?'-'+dataManager.formatMoney(p.diff):'OK'}</div>
                <div class="col-span-2 text-right text-sky-400 font-bold">${buy > 0 ? '+'+buy : '-'}</div>
            </div>`;
        });
    },

    renderGamification() {
        const income = parseFloat(document.getElementById('header-income').innerText.replace('R$','').replace('.','').replace(',','.'));
        const levels = [{n:"Iniciante",v:0,c:"text-slate-400"},{n:"Investidor",v:100,c:"text-sky-400"},{n:"Barão",v:1000,c:"text-purple-400"},{n:"Rei",v:5000,c:"text-yellow-400"}];
        let lvl = levels[0], next = levels[1];
        for(let i=0; i<levels.length; i++) if(income >= levels[i].v) { lvl=levels[i]; next=levels[i+1]||{v:income*2}; }
        const pct = Math.min(100, ((income-lvl.v)/(next.v-lvl.v))*100);
        document.getElementById('user-level-name').innerText = lvl.n;
        document.getElementById('user-level-name').className = `text-sm font-bold ${lvl.c}`;
        document.getElementById('user-level-progress').style.width = `${pct}%`;
    },

    renderAnalysis() {
        const portfolio = dataManager.getConsolidatedPortfolio();
        let score = 100;
        const count = portfolio.length;
        // Lógica simples de score
        if(count < 5) score -= 20;
        const maxConc = Math.max(...portfolio.map(p => p.totalCurrent)) / portfolio.reduce((a,b)=>a+b.totalCurrent,0);
        if(maxConc > 0.25) score -= 20;
        
        document.getElementById('analysis-score').innerText = Math.max(0, score);
        const verdict = score > 80 ? "Excelente" : score > 50 ? "Bom" : "Atenção";
        const vEl = document.getElementById('analysis-verdict');
        vEl.innerText = verdict;
        vEl.className = `text-xl font-bold ${score > 80 ? 'text-green-400' : score > 50 ? 'text-yellow-400' : 'text-red-400'}`;
        
        const updateCard = (id, s, m) => {
            const el = document.getElementById(id);
            el.querySelector('.msg').innerText = m;
            el.className = `card-glass p-5 flex gap-4 border-l-4 ${s ? 'border-green-500' : 'border-red-500'}`;
        };
        updateCard('check-diversification', count >= 5, `${count} ativos na carteira.`);
        updateCard('check-concentration', maxConc <= 0.25, `Maior ativo: ${(maxConc*100).toFixed(1)}%`);
        updateCard('check-sectors', new Set(portfolio.map(p=>p.sector)).size >= 3, `${new Set(portfolio.map(p=>p.sector)).size} setores.`);
        
        const circle = document.getElementById('score-circle');
        const circ = circle.r.baseVal.value * 2 * Math.PI;
        circle.style.strokeDashoffset = circ - (score/100)*circ;
        circle.style.stroke = score > 80 ? '#22c55e' : score > 50 ? '#eab308' : '#ef4444';
    },

    renderMagic() {
        const grid = document.getElementById('magic-grid');
        grid.innerHTML = '';
        dataManager.getConsolidatedPortfolio().forEach(p => {
            if(p.div <= 0) return;
            const magic = Math.ceil(p.currentPrice / p.div);
            const remain = Math.max(0, magic - p.qtd);
            const isMagic = remain === 0;
            grid.innerHTML += `
            <div class="card-glass p-6 relative overflow-hidden ${isMagic ? 'border-yellow-500/50 bg-yellow-500/5' : ''}">
                ${isMagic ? '<div class="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-bl-lg">MÁGICO!</div>' : ''}
                <div class="flex justify-between mb-4"><div class="flex items-center gap-3"><div class="w-10 h-10 bg-slate-800 rounded flex items-center justify-center font-bold text-white border border-slate-700">${p.ticker.substring(0,2)}</div><div><h4 class="font-bold text-white">${p.ticker}</h4><p class="text-xs text-slate-400">Meta: ${magic}</p></div></div></div>
                <div class="flex justify-between text-xs text-slate-300 mb-2"><span>${p.qtd} Atuais</span><span>${remain} Faltam</span></div>
                <div class="w-full bg-slate-700 h-2 rounded-full mb-4 overflow-hidden"><div class="bg-${isMagic?'yellow':'sky'}-500 h-full" style="width: ${Math.min(100,(p.qtd/magic)*100)}%"></div></div>
                ${!isMagic ? `<div class="bg-slate-800 p-2 rounded text-center border border-slate-700"><p class="text-[10px] text-slate-400">Custo</p><p class="text-sm font-bold text-white">${dataManager.formatMoney(remain*p.currentPrice)}</p></div>` : ''}
            </div>`;
        });
    },

    renderFire() {
        const p = dataManager.getConsolidatedPortfolio();
        const inc = p.reduce((a,b)=>a+b.monthlyIncome,0);
        const inv = p.reduce((a,b)=>a+b.invested,0);
        const goal = dataManager.fireGoal;
        const pct = Math.min(100, (inc/goal)*100);
        document.getElementById('fire-percentage').innerText = pct.toFixed(2);
        document.getElementById('fire-current-income').innerText = dataManager.formatMoney(inc);
        document.getElementById('fire-target-income').innerText = dataManager.formatMoney(goal);
        document.getElementById('fire-progress-bar').style.width = pct + '%';
        const dy = inv > 0 ? inc/inv : 0.008;
        const needed = goal/dy;
        document.getElementById('fire-patrimony-needed').innerText = dataManager.formatMoney(needed);
        const gap = needed - inv;
        const est = (gap / (1000 + inc)) / 12;
        document.getElementById('fire-time-estimation').innerText = gap <= 0 ? "LIVRE!" : `~${est.toFixed(1)} anos`;
    },

    renderSimulation() {
        const p = dataManager.getConsolidatedPortfolio();
        if(p.length === 0) return;
        const contribution = parseFloat(document.getElementById('sim-monthly-contribution').value)||1000;
        const years = parseInt(document.getElementById('sim-years').value)||5;
        document.getElementById('sim-years-display').innerText = years + ' anos';
        
        let pat = p.reduce((a,b)=>a+b.totalCurrent,0);
        const inc = p.reduce((a,b)=>a+b.monthlyIncome,0);
        const dy = pat > 0 ? inc/pat : 0.008;
        
        const labels = [], dataPat = [], dataInv = [];
        let inv = p.reduce((a,b)=>a+b.invested,0);
        
        for(let m=1; m<=years*12; m++) {
            pat += contribution + (pat*dy);
            inv += contribution;
            if(m % 6 === 0) { labels.push('M'+m); dataPat.push(pat); dataInv.push(inv); }
        }
        
        document.getElementById('sim-final-value').innerText = dataManager.formatMoney(pat);
        
        const ctx = document.getElementById('simulationChart');
        if(app.simChart) app.simChart.destroy();
        app.simChart = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets: [{label:'Patrimônio', data:dataPat, borderColor:'#4ade80', backgroundColor:'rgba(74,222,128,0.1)', fill:true}, {label:'Aportado', data:dataInv, borderColor:'#38bdf8', borderDash:[5,5]}] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'top' } }, scales: { y: { grid: { color: '#1e293b' } } } }
        });
    },

    saveFireGoal() {
        dataManager.fireGoal = parseFloat(document.getElementById('fire-goal-input').value);
        dataManager.saveData();
        this.renderFire();
    }
};

// Expor para o escopo global
window.viewRenderer = viewRenderer;
window.app = app;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // A inicialização é feita no data.js ou index.html dependendo da ordem de carga
    // Mas viewRenderer precisa estar disponível.
    if (window.dataManager) app.init();
});