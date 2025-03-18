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
const COUNTDOWN_DURATION = 10; // 10 seconds countdown
const SIREN_DELAY = 0; // No delay, play immediately
const SIREN_DURATION = 2; // 2 seconds

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isCountdown, setIsCountdown] = useState(false);
  const [time, setTime] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [currentComment, setCurrentComment] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const audioContext = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const microphone = useRef<MediaStreamAudioSourceNode | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sirenAudio = useRef<{ play: () => void } | null>(null);

  useEffect(() => {
    // Initialize audio context
    try {
      audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyser.current = audioContext.current.createAnalyser();
      analyser.current.fftSize = 4096;
      analyser.current.smoothingTimeConstant = 0.8;

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
    } catch (error) {
      console.error('Error initializing audio context:', error);
    }

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

  const startRecording = async () => {
    try {
      setIsProcessing(true);
      
      // Resume audio context if it was suspended
      if (audioContext.current && audioContext.current.state === 'suspended') {
        await audioContext.current.resume();
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      if (!audioContext.current || !analyser.current) {
        throw new Error('Audio context not initialized');
      }

      microphone.current = audioContext.current.createMediaStreamSource(stream);
      microphone.current.connect(analyser.current);
      setIsRecording(true);
      setIsProcessing(false);

      // Start the timer
      startStopwatch();
    } catch (error) {
      console.error('Error accessing microphone:', error);
      setIsProcessing(false);
      setIsRecording(false);
      alert('Error accessing microphone. Please make sure you have granted microphone permissions.');
    }
  };

  const stopRecording = () => {
    try {
      if (microphone.current) {
        microphone.current.disconnect();
        microphone.current = null;
      }
      setIsRecording(false);
      setIsProcessing(false);
      
      // Start countdown
      startCountdown();
    } catch (error) {
      console.error('Error stopping recording:', error);
      setIsRecording(false);
      setIsProcessing(false);
    }
  };

  const startStopwatch = () => {
    setTime(0);
    intervalRef.current = setInterval(() => {
      setTime(prevTime => prevTime + 1);
    }, 1000);
  };

  const startCountdown = () => {
    setIsCountdown(true);
    setTime(COUNTDOWN_DURATION);
    intervalRef.current = setInterval(() => {
      setTime(prevTime => {
        if (prevTime <= 1) {
          stopCountdown();
          return 0;
        }
        return prevTime - 1;
      });
    }, 1000);
  };

  const stopCountdown = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsCountdown(false);
    
    // Add entry to history
    const newEntry: TimeEntry = {
      id: Date.now(),
      time: formatTime(time),
      comment: currentComment,
      timestamp: new Date()
    };
    setEntries(prevEntries => [newEntry, ...prevEntries]);
    setCurrentComment('');

    // Play siren immediately
    if (sirenAudio.current) {
      sirenAudio.current.play();
    }
  };

  const resetStopwatch = () => {
    if (microphone.current) {
      microphone.current.disconnect();
      microphone.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRecording(false);
    setIsCountdown(false);
    setTime(0);
    setCurrentComment('');
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const deleteEntry = (id: number) => {
    setEntries(prevEntries => prevEntries.filter(entry => entry.id !== id));
  };

  return (
    <ThemeProvider theme={theme}>
      <Container maxWidth="md">
        <Box sx={{ py: 4 }}>
          <Typography variant="h1" align="center" gutterBottom>
            Voice Stopwatch
          </Typography>
          
          <StyledPaper>
            <TimerDisplay align="center">
              {formatTime(time)}
            </TimerDisplay>
            
            <ButtonContainer>
              <Button
                variant="contained"
                color="primary"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing || isCountdown}
                startIcon={isProcessing ? <CircularProgress size={20} /> : <MicIcon />}
              >
                {isRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
              
              <Button
                variant="outlined"
                color="secondary"
                onClick={resetStopwatch}
                disabled={!isRecording && !isCountdown && time === 0}
                startIcon={<RestartAltIcon />}
              >
                Reset
              </Button>
            </ButtonContainer>

            <Typography
              variant="body2"
              align="center"
              color="text.secondary"
              sx={{ mb: 3 }}
            >
              {isRecording ? 'Recording in progress...' : 
               isCountdown ? `Countdown: ${time} seconds remaining` : 
               'Click Start Recording to begin'}
            </Typography>

            <TextField
              fullWidth
              label="Add Comment"
              value={currentComment}
              onChange={(e) => setCurrentComment(e.target.value)}
              disabled={!isRecording && !isCountdown}
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom>
              History
            </Typography>
            
            <List>
              {entries.map((entry) => (
                <StyledListItem
                  key={entry.id}
                  secondaryAction={
                    <IconButton edge="end" onClick={() => deleteEntry(entry.id)}>
                      <DeleteIcon />
                    </IconButton>
                  }
                >
                  <ListItemText
                    primary={entry.time}
                    secondary={
                      <>
                        {entry.comment && (
                          <Typography component="span" variant="body2" color="text.secondary">
                            {entry.comment}
                          </Typography>
                        )}
                        <br />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {entry.timestamp.toLocaleString()}
                        </Typography>
                      </>
                    }
                  />
                </StyledListItem>
              ))}
            </List>
          </StyledPaper>
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
