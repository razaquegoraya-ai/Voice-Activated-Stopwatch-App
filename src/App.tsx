import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Box,
  Typography,
  Button,
  TextField,
  List,
  ListItem,
  ListItemText,
  Paper,
  IconButton,
  CircularProgress,
  ThemeProvider,
  createTheme,
  Divider,
  Fade
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import TimerIcon from '@mui/icons-material/Timer';
import MicIcon from '@mui/icons-material/Mic';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { styled } from '@mui/material/styles';

// Create a custom theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '3.5rem',
      fontWeight: 500,
    },
    h2: {
      fontSize: '4rem',
      fontWeight: 700,
      letterSpacing: '0.1rem',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontSize: '1rem',
          padding: '10px 20px',
        },
      },
    },
  },
});

const StyledPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  margin: theme.spacing(3, 0),
  backgroundColor: '#ffffff',
  borderRadius: 16,
  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
}));

const TimerDisplay = styled(Typography)(({ theme }) => ({
  fontFamily: '"Roboto Mono", monospace',
  fontSize: '6rem',
  fontWeight: 700,
  color: theme.palette.primary.main,
  textShadow: '2px 2px 4px rgba(0, 0, 0, 0.1)',
  margin: theme.spacing(2, 0),
}));

const ButtonContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'center',
  gap: theme.spacing(2),
  marginBottom: theme.spacing(3),
  '& .MuiButton-root': {
    minWidth: 200,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
}));

const StyledListItem = styled(ListItem)(({ theme }) => ({
  backgroundColor: '#f8f9fa',
  borderRadius: 8,
  marginBottom: theme.spacing(1),
  '&:hover': {
    backgroundColor: '#f0f2f5',
  },
}));

interface TimeEntry {
  id: number;
  time: string;
  comment: string;
  timestamp: Date;
}

const SOUND_THRESHOLD = 0.05;
const STOPWATCH_DURATION = 10;
const SIREN_DELAY = 3;
const SIREN_DURATION = 2;

function App() {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentComment, setCurrentComment] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const commandAudio = useRef<HTMLAudioElement | null>(null);
  const sirenAudio = useRef<{ play: () => void } | null>(null);

  useEffect(() => {
    // Initialize audio context
    audioContext.current = new AudioContext();
    analyser.current = audioContext.current.createAnalyser();
    analyser.current.fftSize = 4096;
    analyser.current.smoothingTimeConstant = 0.8;

    // Load command audio
    commandAudio.current = new Audio('/command.mp3');

    // Create siren sound
    const createSiren = () => {
      const siren = audioContext.current!.createOscillator();
      const gainNode = audioContext.current!.createGain();
      siren.connect(gainNode);
      gainNode.connect(audioContext.current!.destination);

      siren.type = 'sine';
      siren.frequency.setValueAtTime(440, audioContext.current!.currentTime);
      gainNode.gain.setValueAtTime(0.5, audioContext.current!.currentTime);

      return { siren, gainNode };
    };

    const playSirenSound = () => {
      const { siren, gainNode } = createSiren();
      siren.start();
      siren.frequency.exponentialRampToValueAtTime(880, audioContext.current!.currentTime + SIREN_DURATION/2);
      siren.frequency.exponentialRampToValueAtTime(440, audioContext.current!.currentTime + SIREN_DURATION);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.current!.currentTime + SIREN_DURATION);
      siren.stop(audioContext.current!.currentTime + SIREN_DURATION);
    };

    sirenAudio.current = { play: playSirenSound } as any;

    // Add keyboard event listener for reset
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        resetStopwatch();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (audioContext.current) {
        audioContext.current.close();
      }
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);

  const startListening = async () => {
    try {
      setIsProcessing(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphone.current = audioContext.current!.createMediaStreamSource(stream);
      microphone.current.connect(analyser.current!);
      setIsListening(true);

      // Start analyzing audio for command detection
      analyzeAudio();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsProcessing(false);
    }
  };

  const analyzeAudio = () => {
    if (!analyser.current || !isListening) return;

    const dataArray = new Float32Array(analyser.current.frequencyBinCount);
    analyser.current.getFloatTimeDomainData(dataArray);

    // Calculate RMS value with improved sensitivity
    let sum = 0;
    let peakInstantaneousPower = 0;

    for (let i = 0; i < dataArray.length; i++) {
      const power = dataArray[i] * dataArray[i];
      sum += power;
      peakInstantaneousPower = Math.max(peakInstantaneousPower, power);
    }

    const rms = Math.sqrt(sum / dataArray.length);

    // Use both RMS and peak detection for better sensitivity
    if (rms > SOUND_THRESHOLD || peakInstantaneousPower > SOUND_THRESHOLD * 2) {
      checkForCommand();
    }

    requestAnimationFrame(analyzeAudio);
  };

  const checkForCommand = () => {
    if (!isRunning) {
      startStopwatch();
      setIsProcessing(false);
    }
  };

  const stopListening = () => {
    if (microphone.current) {
      microphone.current.disconnect();
      setIsListening(false);
    }
    setIsProcessing(false);
  };

  const startStopwatch = () => {
    setIsRunning(true);
    setTime(0);
    intervalRef.current = setInterval(() => {
      setTime(prevTime => {
        if (prevTime >= STOPWATCH_DURATION) {
          stopStopwatch();
          return prevTime;
        }
        return prevTime + 1;
      });
    }, 1000);
  };

  const stopStopwatch = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsRunning(false);

    // Add the entry
    const newEntry: TimeEntry = {
      id: Date.now(),
      time: formatTime(time),
      comment: currentComment,
      timestamp: new Date()
    };

    setEntries(prev => [...prev, newEntry]);
    setCurrentComment('');

    // Play siren after specified delay
    setTimeout(() => {
      if (sirenAudio.current) {
        sirenAudio.current.play();
      }
    }, SIREN_DELAY * 1000);
  };

  const resetStopwatch = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsRunning(false);
    setTime(0);
    setCurrentComment('');
    setIsProcessing(false);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const deleteEntry = (id: number) => {
    setEntries(prev => prev.filter(entry => entry.id !== id));
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md">
        <Box sx={{ my: 6 }}>
          <Fade in={true} timeout={1000}>
            <Box textAlign="center" mb={4}>
              <TimerIcon sx={{ fontSize: 40, color: 'primary.main', mb: 2 }} />
              <Typography variant="h1" gutterBottom>
                Stopwatch App
              </Typography>
            </Box>
          </Fade>

          <StyledPaper elevation={3}>
            <Fade in={true} timeout={1500}>
              <Box>
                <TimerDisplay align="center" gutterBottom>
                  {formatTime(time)}
                </TimerDisplay>

                <ButtonContainer>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={startListening}
                    disabled={isListening || isProcessing}
                    startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : <MicIcon />}
                  >
                    {isProcessing ? 'Processing...' : 'Start Voice Command'}
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={stopListening}
                    disabled={!isListening}
                    startIcon={<MicIcon />}
                  >
                    Stop Voice Command
                  </Button>
                  <Button
                    variant="contained"
                    color="error"
                    onClick={resetStopwatch}
                    disabled={!isRunning && time === 0}
                    startIcon={<RestartAltIcon />}
                  >
                    Reset
                  </Button>
                </ButtonContainer>

                <Typography
                  variant="body2"
                  align="center"
                  color="text.secondary"
                  sx={{
                    mb: 3,
                    backgroundColor: '#f5f5f5',
                    py: 1,
                    borderRadius: 1,
                    fontWeight: 500
                  }}
                >
                  Press 'R' key to reset the stopwatch
                </Typography>

                <TextField
                  fullWidth
                  label="Add a comment"
                  value={currentComment}
                  onChange={(e) => setCurrentComment(e.target.value)}
                  disabled={!isRunning}
                  variant="outlined"
                  sx={{
                    mt: 2,
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
              </Box>
            </Fade>
          </StyledPaper>

          <Box sx={{ mt: 6 }}>
            <Typography variant="h5" gutterBottom sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: 'text.primary',
              fontWeight: 500,
            }}>
              <TimerIcon sx={{ fontSize: 28 }} />
              Previous Times
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <List>
              {entries.map((entry) => (
                <Fade in={true} key={entry.id}>
                  <StyledListItem
                    secondaryAction={
                      <IconButton
                        edge="end"
                        onClick={() => deleteEntry(entry.id)}
                        sx={{
                          '&:hover': {
                            color: 'error.main',
                            backgroundColor: 'rgba(244, 67, 54, 0.1)',
                          },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={
                        <Typography variant="h6" component="span">
                          {entry.time}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="body2" color="text.secondary">
                          {entry.comment || 'No comment'} • {new Date(entry.timestamp).toLocaleTimeString()}
                        </Typography>
                      }
                    />
                  </StyledListItem>
                </Fade>
              ))}
            </List>
          </Box>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
