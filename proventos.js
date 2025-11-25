const dividendManager = {
    // Estrutura: { "HGLG11": { "2023-11": 1.10, "2023-12": 1.00 } }
    history: {},

    init() {
        if (typeof storageManager !== 'undefined') {
            this.history = storageManager.loadDividends();
        }
    },

    setDividend(ticker, monthStr, value) {
        if (!ticker || !monthStr) return;
        const t = ticker.toUpperCase();
        
        if (!this.history[t]) this.history[t] = {};
        this.history[t][monthStr] = parseFloat(value);
        
        this.save();
    },

    getDividend(ticker, monthStr) {
        const t = ticker.toUpperCase();
        if (this.history[t] && this.history[t][monthStr] !== undefined) {
            return this.history[t][monthStr];
        }
        return 0;
    },

    getLastDividend(ticker) {
        const t = ticker.toUpperCase();
        if (!this.history[t]) return 0;
        const dates = Object.keys(this.history[t]).sort();
        if (dates.length === 0) return 0;
        const lastDate = dates[dates.length - 1];
        return this.history[t][lastDate];
    },

    // NOVO: Recupera todos os meses relevantes (onde houve compra ou onde tem dividendo salvo)
    getHistoryMonths() {
        const months = new Set();
        
        // 1. Adiciona meses onde existem dividendos salvos
        Object.values(this.history).forEach(datesObj => {
            Object.keys(datesObj).forEach(date => months.add(date));
        });

        // 2. Adiciona meses onde existem transações (importadas ou manuais)
        if (window.dataManager) {
            dataManager.transactions.forEach(t => {
                // t.date já é "YYYY-MM"
                if(t.date) months.add(t.date);
            });
        }

        // 3. Garante que o mês atual sempre apareça, mesmo sem dados
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
        months.add(currentMonth);

        // Retorna ordenado (Crescente)
        return Array.from(months).sort();
    },

    save() {
        if (typeof storageManager !== 'undefined') {
            storageManager.saveDividends(this.history);
        }
        if (window.viewRenderer && app.currentTab === 'dashboard') viewRenderer.renderDashboard();
    },

    getOwnedTickers() {
        if (!window.dataManager) return [];
        const tickers = new Set(dataManager.transactions.map(t => t.ticker));
        return Array.from(tickers).sort();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    dividendManager.init();
});

window.dividendManager = dividendManager;