import eel
import simpy
import random
import statistics
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
web_dir = os.path.join(script_dir, "web")

LAB_PROBABILITY = 0.4

def run_simulation(arrival_rate, sim_time, reception_n, doctor_n, 
                   lab_n, pharmacy_n, sr, sd, sl, sp):
    
    random.seed(42)
    
    wait_times = {
        "reception": [],
        "doctor": [],
        "lab": [],
        "pharmacy": []
    }
    
    def service_time(rate):
        return 60.0 / rate if rate > 0 else 60
    
    def patient(env, reception, doctor, lab, pharmacy):
        # Reception
        t0 = env.now
        with reception.request() as req:
            yield req
            wait_times["reception"].append(env.now - t0)
            yield env.timeout(service_time(sr))
        
        # Doctor
        t0 = env.now
        with doctor.request() as req:
            yield req
            wait_times["doctor"].append(env.now - t0)
            yield env.timeout(service_time(sd))
        
        # Lab (only if needed and lab exists)
        if lab_n > 0 and random.random() < LAB_PROBABILITY:
            t0 = env.now
            with lab.request() as req:
                yield req
                wait_times["lab"].append(env.now - t0)
                yield env.timeout(service_time(sl))
        else:
            wait_times["lab"].append(0)
        
        # Pharmacy
        t0 = env.now
        with pharmacy.request() as req:
            yield req
            wait_times["pharmacy"].append(env.now - t0)
            yield env.timeout(service_time(sp))
    
    def generator(env, reception, doctor, lab, pharmacy):
        if arrival_rate <= 0:
            return

        while True:
            inter_arrival = random.expovariate(arrival_rate / 60.0)
            yield env.timeout(inter_arrival)
            env.process(patient(env, reception, doctor, lab, pharmacy))
    
    # Create resources
    env = simpy.Environment()
    reception = simpy.Resource(env, capacity=reception_n)
    doctor = simpy.Resource(env, capacity=doctor_n)
    lab = simpy.Resource(env, capacity=lab_n) if lab_n > 0 else None
    pharmacy = simpy.Resource(env, capacity=pharmacy_n)
    
    # Run simulation
    env.process(generator(env, reception, doctor, lab, pharmacy))
    env.run(until=sim_time * 60)
    
    # Calculate averages
    avg_wait = {}
    for k, v in wait_times.items():
        if v and len(v) > 0:
            avg_wait[k] = statistics.mean(v)
        else:
            avg_wait[k] = 0
    
    # Find bottleneck
    bottleneck = max(avg_wait, key=avg_wait.get) if avg_wait else "none"
    
    advice_map = {
        "reception": "Increase reception staff or improve check-in efficiency",
        "doctor": "Add more doctors or extend consultation hours",
        "lab": "Increase lab capacity or add more technicians",
        "pharmacy": "Add pharmacy counters or automate dispensing",
        "none": "System appears balanced"
    }
    
    return {
        "wait": avg_wait,
        "bottleneck": bottleneck,
        "advice": advice_map.get(bottleneck, "Monitor system performance"),
        "total_patients": len(wait_times["reception"]),
        "total_time": sum(avg_wait.values())
    }


@eel.expose
def run_simulation_api(params):
    print("Running simulation with params:", params)
    result = run_simulation(**params)
    print("Simulation complete! Total patients:", result['total_patients'])
    return result

eel.init(web_dir)
eel.start('index.html', size=(1200, 800), port=8001)