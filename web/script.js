let waitTimeChart, pieChart;

async function runSimulation() {
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Running simulation... Please wait...';
    statusDiv.className = 'status';

    const params = {
        arrival_rate: parseFloat(document.getElementById('arrival_rate').value),
        sim_time: parseFloat(document.getElementById('sim_time').value),
        reception_n: parseInt(document.getElementById('reception_n').value),
        doctor_n: parseInt(document.getElementById('doctor_n').value),
        lab_n: parseInt(document.getElementById('lab_n').value),
        pharmacy_n: parseInt(document.getElementById('pharmacy_n').value),
        sr: parseFloat(document.getElementById('sr').value),
        sd: parseFloat(document.getElementById('sd').value),
        sl: parseFloat(document.getElementById('sl').value),
        sp: parseFloat(document.getElementById('sp').value)
    };

    try {
        validateParams(params);
        const result = await eel.run_simulation_api(params)();
        displayResults(result);
        statusDiv.textContent = '✅ Simulation completed successfully!';
        statusDiv.className = 'status success';
    } catch (error) {
        console.error(error);
        statusDiv.textContent = '❌ Error: ' + (error.message || error);
        statusDiv.className = 'status error';
    }
}

function validateParams(params) {
    if (isNaN(params.arrival_rate) || params.arrival_rate < 0) {
        throw new Error('Arrival rate must be a number greater than or equal to 0.');
    }
    if (isNaN(params.sim_time) || params.sim_time <= 0) {
        throw new Error('Simulation time must be a number greater than 0.');
    }
    if (isNaN(params.reception_n) || params.reception_n <= 0) {
        throw new Error('Receptionists must be at least 1.');
    }
    if (isNaN(params.doctor_n) || params.doctor_n <= 0) {
        throw new Error('Doctors must be at least 1.');
    }
    if (isNaN(params.lab_n) || params.lab_n < 0) {
        throw new Error('Lab technicians must be 0 or greater.');
    }
    if (isNaN(params.pharmacy_n) || params.pharmacy_n <= 0) {
        throw new Error('Pharmacy counters must be at least 1.');
    }
    ['sr', 'sd', 'sl', 'sp'].forEach(key => {
        if (isNaN(params[key]) || params[key] <= 0) {
            throw new Error('All service rates must be numbers greater than 0.');
        }
    });
}

function displayResults(result) {
    const metricsDiv = document.getElementById('metrics');
    metricsDiv.innerHTML = `
        <div class="metric-card">
            <h3>Total Patients</h3>
            <div class="value">${result.total_patients}</div>
            <div class="unit">patients served</div>
        </div>
        <div class="metric-card">
            <h3>Total Journey Time</h3>
            <div class="value">${result.total_time.toFixed(1)}</div>
            <div class="unit">minutes</div>
        </div>
        <div class="metric-card bottleneck-card">
            <h3>🚨 Bottleneck</h3>
            <div class="value">${result.bottleneck.toUpperCase()}</div>
            <div class="unit">critical stage</div>
        </div>
        <div class="metric-card rating-card">
            <h3>Performance Rating</h3>
            <div class="value">${getRating(result.total_time)}</div>
            <div class="unit">${getRatingDescription(result.total_time)}</div>
        </div>
    `;
    
    // Add stage-specific metrics
    for (const [stage, wait] of Object.entries(result.wait)) {
        metricsDiv.innerHTML += `
            <div class="metric-card">
                <h3>${stage.toUpperCase()} Wait</h3>
                <div class="value">${wait.toFixed(1)}</div>
                <div class="unit">minutes</div>
            </div>
        `;
    }
    
    updateCharts(result);
    updateAnalysis(result);
}

function updateCharts(result) {
    const stages = Object.keys(result.wait);
    const times = Object.values(result.wait);
    
    if (waitTimeChart) waitTimeChart.destroy();
    if (pieChart) pieChart.destroy();
    
    const ctx1 = document.getElementById('waitTimeChart').getContext('2d');
    waitTimeChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: stages,
            datasets: [{
                label: 'Average Wait Time (minutes)',
                data: times,
                backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4facfe'],
                borderRadius: 10
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: 'Wait Times by Stage' }
            }
        }
    });
    
    const ctx2 = document.getElementById('pieChart').getContext('2d');
    pieChart = new Chart(ctx2, {
        type: 'pie',
        data: {
            labels: stages,
            datasets: [{
                data: times,
                backgroundColor: ['#667eea', '#764ba2', '#f093fb', '#4facfe']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                title: { display: true, text: 'Time Distribution' }
            }
        }
    });
}

function updateAnalysis(result) {
    const analysisDiv = document.getElementById('analysis');
    const totalTime = result.total_time;
    const bottleneckPercent = totalTime > 0 ? (result.wait[result.bottleneck] / totalTime) * 100 : 0;
    
    analysisDiv.innerHTML = `
        <div class="analysis-section">
            <h3>🎯 Bottleneck Analysis</h3>
            <p><strong>Critical Stage:</strong> ${result.bottleneck.toUpperCase()}</p>
            <p><strong>Recommendation:</strong> ${result.advice}</p>
            <p><strong>Impact:</strong> The bottleneck stage contributes ${bottleneckPercent.toFixed(1)}% of total waiting time.</p>
        </div>
        
        <div class="analysis-section">
            <h3>💡 Recommendations</h3>
            <ul>
                <li><strong>Immediate Action:</strong> ${result.advice}</li>
                <li><strong>Staffing Optimization:</strong> Consider adding ${Math.max(1, Math.ceil(result.wait[result.bottleneck] / 15))} more staff at the ${result.bottleneck} stage</li>
                <li><strong>Process Improvement:</strong> Implement queue management system and digital check-in</li>
                ${totalTime > 60 ? '<li><strong>URGENT:</strong> Total wait time exceeds target by ' + (totalTime - 60).toFixed(0) + ' minutes</li>' : ''}
            </ul>
        </div>
        
        <div class="analysis-section">
            <h3>📊 Efficiency Metrics</h3>
            <ul>
                <li>Patient Throughput: ${result.total_patients} patients in ${document.getElementById('sim_time').value} hours</li>
                <li>Average Processing Rate: ${(result.total_patients / parseFloat(document.getElementById('sim_time').value)).toFixed(1)} patients/hour</li>
                <li>System Efficiency: ${getEfficiencyScore(totalTime)}%</li>
            </ul>
        </div>
    `;
}

function getRating(totalTime) {
    if (totalTime < 30) return '🟢 EXCELLENT';
    if (totalTime < 60) return '🟡 GOOD';
    if (totalTime < 90) return '🟠 NEEDS IMPROVEMENT';
    return '🔴 POOR';
}

function getRatingDescription(totalTime) {
    if (totalTime < 30) return 'Patient flow is very efficient';
    if (totalTime < 60) return 'Acceptable wait times';
    if (totalTime < 90) return 'Long waits detected';
    return 'Critical delays, immediate action needed';
}

function getEfficiencyScore(totalTime) {
    if (totalTime < 30) return 95;
    if (totalTime < 60) return 75;
    if (totalTime < 90) return 50;
    return 25;
}

function resetDefaults() {
    document.getElementById('arrival_rate').value = '30';
    document.getElementById('sim_time').value = '8';
    document.getElementById('reception_n').value = '2';
    document.getElementById('doctor_n').value = '3';
    document.getElementById('lab_n').value = '1';
    document.getElementById('pharmacy_n').value = '2';
    document.getElementById('sr').value = '20';
    document.getElementById('sd').value = '6';
    document.getElementById('sl').value = '12';
    document.getElementById('sp').value = '15';
    
    const statusDiv = document.getElementById('status');
    statusDiv.textContent = 'Defaults restored';
    statusDiv.className = 'status success';
    setTimeout(() => {
        statusDiv.className = 'status';
        statusDiv.textContent = '';
    }, 2000);
}

function showTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    document.getElementById(`${tabName}-tab`).classList.add('active');
    if (event && event.target) {
        event.target.classList.add('active');
    }
}