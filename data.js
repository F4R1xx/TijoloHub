const dataManager = {
    transactions: [],
    targetWeights: {},
    fireGoal: 5000,

    init() {
        this.loadData();
    },

    loadData() {
        if (typeof storageManager !== 'undefined') {
            this.transactions = storageManager.loadTransactions();
            this.fireGoal = storageManager.loadFireGoal();
            this.targetWeights = storageManager.loadTargets();
        }
        if(window.viewRenderer) viewRenderer.updateAll();
    },

    saveData() {
        if (typeof storageManager !== 'undefined') {
            storageManager.saveTransactions(this.transactions);
            storageManager.saveFireGoal(this.fireGoal);
            storageManager.saveTargets(this.targetWeights);
        }
        if(window.viewRenderer) viewRenderer.updateAll();
    },

    handleFile(input) {
        if(input.files.length) {
            const file = input.files[0];
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { defval: "" });
                    this.processImport(jsonData);
                } catch (error) {
                    alert("Erro fatal ao ler arquivo: " + error.message);
                }
            };
            reader.readAsArrayBuffer(file);
            input.value = "";
        }
    },

    // ATUALIZADO: Removemos a coluna Proventos do Modelo
    downloadTemplate() {
        const headers = ["Data", "Ticker", "Quantidade", "Preço Médio", "Setor"];
        const exampleData = [
            ["2023-11-01", "HGLG11", 10, 160.50, "Logística"],
            ["2023-12-05", "MXRF11", 100, 10.35, "Híbrido"]
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers, ...exampleData]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Modelo TijoloHub");
        XLSX.writeFile(wb, "TijoloHub_Modelo.xlsx");
    },

    findValue(row, possibleKeys) {
        if (!row) return null;
        const normalizedRowKeys = {};
        Object.keys(row).forEach(k => {
            const cleanKey = k.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            normalizedRowKeys[cleanKey] = row[k];
        });

        for (const key of possibleKeys) {
            const cleanPossible = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
            if (normalizedRowKeys[cleanPossible] !== undefined) return normalizedRowKeys[cleanPossible];
        }
        return null;
    },

    parseNumber(value) {
        if (value === undefined || value === null || value === "") return 0;
        if (typeof value === 'number') return value;
        let str = value.toString().trim().replace("R$", "").replace("$", "").trim();
        const lastComma = str.lastIndexOf(',');
        const lastDot = str.lastIndexOf('.');
        if (lastComma > lastDot) str = str.replace(/\./g, '').replace(',', '.');
        else if (lastDot > lastComma) str = str.replace(/,/g, '');
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    },

    processImport(data) {
        const now = new Date();
        const defaultDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        let newTx = [];
        let datesDefaultedCount = 0; 

        if (data.length === 0) { alert("Arquivo vazio."); return; }

        newTx = data.map((row) => {
            const ticker = this.findValue(row, ['Ticker', 'Ativo', 'Código', 'Papel', 'Fundo']);
            const qtdRaw = this.findValue(row, ['Quantidade', 'Qtd', 'Quant', 'Cotas']);
            const pmRaw = this.findValue(row, ['Preço Médio', 'Preco Medio', 'PM', 'Preço']);
            const dataRaw = this.findValue(row, ['Data', 'Date', 'Dia', 'Data Aporte', 'Data da Compra', 'Data do Negócio']);
            const setorRaw = this.findValue(row, ['Setor', 'Segmento', 'Tipo']);

            if (!ticker || !qtdRaw) return null;

            const qtd = this.parseNumber(qtdRaw);
            const pm = this.parseNumber(pmRaw);
            
            let date = defaultDate;
            
            if (dataRaw) {
                if (dataRaw instanceof Date) {
                    try { date = dataRaw.toISOString().substring(0, 7); } catch (e) { date = defaultDate; }
                } else if (typeof dataRaw === 'number') {
                    const excelDate = new Date((dataRaw - 25569) * 86400 * 1000 + (12 * 3600 * 1000));
                    date = excelDate.toISOString().substring(0, 7);
                } else {
                    let dStr = dataRaw.toString().trim();
                    if (dStr.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                        const parts = dStr.split('/');
                        date = `${parts[2]}-${parts[1]}`; // YYYY-MM
                    } else if (dStr.match(/^\d{4}-\d{2}/)) {
                        date = dStr.substring(0, 7); // YYYY-MM
                    }
                }
            } else {
                datesDefaultedCount++;
            }

            const sector = setorRaw || this.identifySector(ticker);

            return {
                id: crypto.randomUUID(),
                date, // Data formatada YYYY-MM
                ticker: ticker.toString().toUpperCase().trim(),
                qtd, 
                price: pm,
                sector
                // Provento removido daqui
            };
        }).filter(t => t !== null && t.qtd > 0);

        if (newTx.length === 0) { alert("Nenhum dado válido."); return; }
        if (datesDefaultedCount > 0) alert(`${datesDefaultedCount} linhas sem data foram salvas em ${defaultDate}.`);
        else alert(`${newTx.length} registros importados!`);

        this.transactions = [...this.transactions, ...newTx];
        this.saveData();
        if(window.app) window.app.switchTab('dashboard');
    },

    saveAsset(e) {
        e.preventDefault();
        const id = document.getElementById('modal-id').value;
        const tx = {
            id: id || crypto.randomUUID(),
            date: document.getElementById('modal-date').value,
            ticker: document.getElementById('modal-ticker').value.toUpperCase(),
            qtd: parseFloat(document.getElementById('modal-qtd').value),
            price: parseFloat(document.getElementById('modal-pm').value),
            sector: document.getElementById('modal-sector').value
        };

        if(id) {
            const idx = this.transactions.findIndex(t => t.id === id);
            if(idx >= 0) this.transactions[idx] = tx;
        } else {
            this.transactions.push(tx);
        }
        
        this.saveData();
        app.closeModal();
        if(app.currentTab === 'history') viewRenderer.renderHistory();
    },

    deleteTransaction(id) {
        if(confirm('Excluir?')) {
            this.transactions = this.transactions.filter(t => t.id !== id);
            this.saveData();
            if(app.currentTab === 'history') viewRenderer.renderHistory();
        }
    },

    resetApp() {
        if(confirm('ATENÇÃO: Apagar tudo?')) {
            if (typeof storageManager !== 'undefined') storageManager.clearAll();
            else localStorage.clear();
            location.reload();
        }
    },

    exportTable() {
        const portfolio = this.getConsolidatedPortfolio();
        if (portfolio.length === 0) { alert("Nada para exportar."); return; }
        const ws = XLSX.utils.json_to_sheet(portfolio);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Carteira");
        XLSX.writeFile(wb, "Carteira.xlsx");
    },

    getConsolidatedPortfolio() {
        const portfolio = {};
        const sortedTx = [...this.transactions].sort((a, b) => a.date.localeCompare(b.date));
        
        sortedTx.forEach(t => {
            if(!portfolio[t.ticker]) {
                portfolio[t.ticker] = { ticker: t.ticker, qtd: 0, invested: 0, sector: t.sector };
            }
            portfolio[t.ticker].qtd += t.qtd;
            portfolio[t.ticker].invested += (t.qtd * t.price);
        });

        return Object.values(portfolio).map(p => {
            const pm = p.qtd > 0 ? p.invested / p.qtd : 0;
            const price = pm; // Simplificado sem randomização
            // Pega o último dividendo conhecido para projeção
            const lastDiv = (window.dividendManager) ? window.dividendManager.getLastDividend(p.ticker) : 0;
            
            return {
                ...p,
                pm,
                currentPrice: price,
                totalCurrent: p.qtd * price,
                div: lastDiv, // Usado para projeções
                monthlyIncome: p.qtd * lastDiv
            };
        });
    },

    identifySector(ticker) {
        const t = ticker.toUpperCase();
        if(t.startsWith('KN') || t.startsWith('CPTS') || t.startsWith('RECR')) return 'Papel';
        if(t.startsWith('HGLG') || t.startsWith('XPLG') || t.startsWith('BTLG')) return 'Logística';
        if(t.startsWith('XPML') || t.startsWith('VISC') || t.startsWith('MALL')) return 'Shopping';
        if(t.startsWith('MXRF') || t.startsWith('VGHF')) return 'Híbrido';
        return 'Outros';
    },

    getColors(count) {
        const colors = ['#0ea5e9', '#8b5cf6', '#22c55e', '#eab308', '#f97316', '#ef4444', '#ec4899', '#6366f1'];
        const result = [];
        for(let i = 0; i < count; i++) { result.push(colors[i % colors.length]); }
        return result;
    },

    formatMoney(val) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val); }
};

window.dataManager = dataManager;