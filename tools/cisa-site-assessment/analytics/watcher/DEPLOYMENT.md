# Pipeline Watcher Deployment Guide

This guide covers different methods to ensure the Pipeline Watcher starts automatically and restarts on failure.

## Deployment Options

### Option 1: Systemd Service (Recommended for Linux)

Systemd is the standard service manager on modern Linux distributions.

#### Installation

```bash
# Run as root
sudo analytics/watcher/scripts/install_systemd.sh
```

#### Manual Installation

1. Copy service file:
```bash
sudo cp analytics/watcher/systemd/pipeline-watcher.service /etc/systemd/system/
```

2. Edit paths in service file:
```bash
sudo nano /etc/systemd/system/pipeline-watcher.service
# Update paths: /opt/psa -> your actual repo path
# Update user: psa -> your actual user
```

3. Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable pipeline-watcher
sudo systemctl start pipeline-watcher
```

#### Management

```bash
# Start
sudo systemctl start pipeline-watcher

# Stop
sudo systemctl stop pipeline-watcher

# Restart
sudo systemctl restart pipeline-watcher

# Status
sudo systemctl status pipeline-watcher

# View logs
sudo journalctl -u pipeline-watcher -f

# Enable auto-start on boot
sudo systemctl enable pipeline-watcher

# Disable auto-start
sudo systemctl disable pipeline-watcher
```

#### Service File Location

`analytics/watcher/systemd/pipeline-watcher.service`

**Features:**
- Automatic restart on failure (Restart=always)
- Restart delay of 10 seconds
- Logs to systemd journal
- Resource limits (memory, file descriptors)
- Security hardening

---

### Option 2: Supervisor (Python Process Manager)

Supervisor is a popular Python-based process manager.

#### Installation

```bash
# Install supervisor
sudo apt-get install supervisor  # Debian/Ubuntu
# or
sudo yum install supervisor        # RHEL/CentOS

# Install watcher config
sudo analytics/watcher/scripts/install_supervisor.sh
```

#### Manual Installation

1. Copy config file:
```bash
sudo cp analytics/watcher/supervisor/pipeline-watcher.conf /etc/supervisor/conf.d/
```

2. Edit paths in config:
```bash
sudo nano /etc/supervisor/conf.d/pipeline-watcher.conf
# Update paths: /opt/psa -> your actual repo path
```

3. Create log directory:
```bash
sudo mkdir -p /var/log/pipeline-watcher
sudo chown psa:psa /var/log/pipeline-watcher
```

4. Reload and start:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start pipeline-watcher
```

#### Management

```bash
# Start
sudo supervisorctl start pipeline-watcher

# Stop
sudo supervisorctl stop pipeline-watcher

# Restart
sudo supervisorctl restart pipeline-watcher

# Status
sudo supervisorctl status pipeline-watcher

# View logs
tail -f /var/log/pipeline-watcher/stdout.log
tail -f /var/log/pipeline-watcher/stderr.log

# View all supervisor processes
sudo supervisorctl status
```

#### Config File Location

`analytics/watcher/supervisor/pipeline-watcher.conf`

**Features:**
- Automatic restart on failure (autorestart=true)
- Start retries (startretries=3)
- Log rotation (maxbytes, backups)
- Process monitoring

---

### Option 3: Cron-Based Monitoring

Simple cron job that checks and restarts the watcher if needed.

#### Setup

1. Make scripts executable:
```bash
chmod +x analytics/watcher/scripts/*.sh
```

2. Add to crontab:
```bash
crontab -e
```

3. Add line (checks every 5 minutes):
```
*/5 * * * * /path/to/analytics/watcher/scripts/cron_watcher.sh
```

#### Manual Management

```bash
# Start
analytics/watcher/scripts/start_watcher.sh

# Stop
analytics/watcher/scripts/stop_watcher.sh

# Restart
analytics/watcher/scripts/restart_watcher.sh

# Check status
analytics/watcher/scripts/check_watcher.sh
```

**Features:**
- Simple, no dependencies
- Works on any system with cron
- Less robust than systemd/supervisor

---

### Option 4: Docker/Container Orchestration

If running in containers, use orchestration tools.

#### Docker Compose

```yaml
services:
  pipeline-watcher:
    build: .
    command: python analytics/watcher/pipeline_watcher.py
    volumes:
      - ./analytics:/app/analytics
    restart: always
    environment:
      - PYTHONPATH=/app
```

#### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pipeline-watcher
spec:
  replicas: 1
  selector:
    matchLabels:
      app: pipeline-watcher
  template:
    metadata:
      labels:
        app: pipeline-watcher
    spec:
      containers:
      - name: watcher
        image: psa/pipeline-watcher:latest
        command: ["python", "analytics/watcher/pipeline_watcher.py"]
        restartPolicy: Always
```

---

### Option 5: Windows Service (NSSM)

For Windows servers, use NSSM (Non-Sucking Service Manager).

#### Automated Installation (PowerShell)

```powershell
# Run PowerShell as Administrator
cd analytics\watcher\scripts
.\install_windows_service.ps1
```

The script will:
- Auto-detect Python installation
- Auto-detect watcher script location
- Install and configure the service
- Set up logging

#### Manual NSSM Installation

1. Download NSSM: https://nssm.cc/download
   - Extract `nssm.exe` to `analytics\watcher\scripts\` or add to PATH

2. Install service (PowerShell as Administrator):
```powershell
$python = "D:\PSA_System\psa_rebuild\venv\Scripts\python.exe"
$watcher = "D:\PSA_System\psa_rebuild\analytics\watcher\pipeline_watcher.py"
$watcherDir = "D:\PSA_System\psa_rebuild\analytics\watcher"

.\nssm.exe install PipelineWatcher $python "$watcher"
.\nssm.exe set PipelineWatcher AppDirectory $watcherDir
.\nssm.exe set PipelineWatcher DisplayName "PSA Pipeline Watcher"
.\nssm.exe set PipelineWatcher Start SERVICE_AUTO_START
```

3. Start service:
```powershell
Start-Service PipelineWatcher
# or
net start PipelineWatcher
```

#### Management

```powershell
# Start
Start-Service PipelineWatcher

# Stop
Stop-Service PipelineWatcher

# Restart
Restart-Service PipelineWatcher

# Status
Get-Service PipelineWatcher

# View logs
Get-Content D:\PSA_System\psa_rebuild\analytics\watcher\watcher_stdout.log -Tail 50 -Wait
```

---

### Option 6: Windows Task Scheduler

Alternative to NSSM for Windows.

#### Automated Installation (PowerShell)

```powershell
# Run PowerShell as Administrator
cd analytics\watcher\scripts
.\install_task_scheduler.ps1
```

#### Manual Installation

1. Open Task Scheduler (taskschd.msc)

2. Create Task (not Basic Task):
   - General tab:
     - Name: "PSA Pipeline Watcher"
     - Description: "Deterministic intake controller"
     - Check "Run whether user is logged on or not"
     - Check "Run with highest privileges"
   
   - Triggers tab:
     - New → "At startup"
   
   - Actions tab:
     - New → Start a program
     - Program: `D:\PSA_System\psa_rebuild\venv\Scripts\python.exe`
     - Arguments: `pipeline_watcher.py`
     - Start in: `D:\PSA_System\psa_rebuild\analytics\watcher`
   
   - Conditions tab:
     - Uncheck "Start the task only if the computer is on AC power"
   
   - Settings tab:
     - Check "Allow task to be run on demand"
     - Check "Run task as soon as possible after a scheduled start is missed"
     - Check "If the task fails, restart every: 1 minute"
     - Set "Attempt to restart up to: 3 times"

#### Management

```powershell
# Start
Start-ScheduledTask -TaskName "PSA Pipeline Watcher"

# Stop
Stop-ScheduledTask -TaskName "PSA Pipeline Watcher"

# Status
Get-ScheduledTask -TaskName "PSA Pipeline Watcher"

# View history
Get-WinEvent -LogName Microsoft-Windows-TaskScheduler/Operational | Where-Object {$_.Message -like "*PSA Pipeline Watcher*"} | Select-Object -First 20
```

---

### Option 7: PowerShell Scripts (Manual Management)

For development or simple deployments.

#### Management Scripts

```powershell
# Start watcher
.\analytics\watcher\scripts\start_watcher.ps1

# Stop watcher
.\analytics\watcher\scripts\stop_watcher.ps1

# Restart watcher
.\analytics\watcher\scripts\restart_watcher.ps1

# Check status
.\analytics\watcher\scripts\check_watcher.ps1
```

#### Batch Scripts (Alternative)

```cmd
REM Start
analytics\watcher\scripts\start_watcher.bat

REM Stop
analytics\watcher\scripts\stop_watcher.bat
```

---

## Verification

After installation, verify the watcher is running:

```bash
# Check process
ps aux | grep pipeline_watcher

# Check logs
tail -f analytics/watcher/watcher.log

# Check systemd
sudo systemctl status pipeline-watcher

# Check supervisor
sudo supervisorctl status pipeline-watcher
```

## Troubleshooting

### Watcher Not Starting

1. Check Python path:
```bash
which python
python --version
```

2. Check permissions:
```bash
ls -la analytics/watcher/pipeline_watcher.py
```

3. Check dependencies:
```bash
python analytics/watcher/pipeline_watcher.py --once
```

### Watcher Keeps Restarting

1. Check logs for errors:
```bash
sudo journalctl -u pipeline-watcher -n 100
```

2. Check file permissions:
```bash
ls -la analytics/incoming/
ls -la analytics/processing/
ls -la analytics/library/
```

3. Check disk space:
```bash
df -h
```

### Service Not Starting on Boot

1. Verify service is enabled:
```bash
sudo systemctl is-enabled pipeline-watcher
```

2. Check service dependencies:
```bash
sudo systemctl list-dependencies pipeline-watcher
```

3. Check systemd logs:
```bash
sudo journalctl -b | grep pipeline-watcher
```

## Recommended Approach

**For Production Linux Servers:**
- Use **systemd** (most reliable, built-in)

**For Development:**
- Use **supervisor** (easier to configure, good logging)

**For Simple Deployments:**
- Use **cron-based monitoring** (minimal setup)

**For Containers:**
- Use **Docker restart policies** or **Kubernetes**

**For Windows:**
- Use **NSSM** (most reliable, proper Windows service)
- Use **Windows Task Scheduler** (built-in, no extra software)
- Use **PowerShell scripts** (for development)

## Security Considerations

1. **Run as non-root user:**
   - Create dedicated `psa` user
   - Set appropriate file permissions

2. **Limit file access:**
   - Use chroot or containerization
   - Restrict directory permissions

3. **Log rotation:**
   - Configure logrotate for systemd
   - Use supervisor log rotation

4. **Resource limits:**
   - Set memory limits in service config
   - Monitor disk usage

