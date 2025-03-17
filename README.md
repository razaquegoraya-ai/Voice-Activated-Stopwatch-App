# Voice-Activated Stopwatch App

A modern React-based stopwatch application that can be controlled using voice commands. Built with TypeScript and Material-UI, this app provides a sleek interface for timing activities with voice activation and comment functionality.

## Features

- 🎤 Voice command activation
- ⏱️ Automatic 10-second stopwatch
- 🔔 Configurable siren alert
- 💬 Comment addition for each timing session
- 📝 History tracking with timestamps
- ⌨️ Keyboard shortcuts for quick control
- 🎨 Modern, responsive UI design

## Technologies Used

- React 18
- TypeScript
- Material-UI (MUI)
- Web Audio API
- MediaStream Recording API

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/voice-stopwatch-app.git
   cd voice-stopwatch-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Usage

1. Click "Start Voice Command" to begin listening for voice input
2. Speak the trigger command to start the stopwatch
3. The stopwatch will run for 10 seconds automatically
4. Add comments while the timer is running
5. After stopping, a siren will sound after a brief delay
6. View and manage your timing history below
7. Press 'R' or click Reset to start over

## Configuration

The following constants can be adjusted in `src/App.tsx`:

- `SOUND_THRESHOLD`: Sensitivity of voice detection (default: 0.05)
- `STOPWATCH_DURATION`: Duration of the stopwatch in seconds (default: 10)
- `SIREN_DELAY`: Delay before siren sounds in seconds (default: 3)
- `SIREN_DURATION`: Duration of the siren sound in seconds (default: 2)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with React and Material-UI
- Uses Web Audio API for sound processing
- Voice command detection implementation
# Voice-Activated-Stopwatch-App
