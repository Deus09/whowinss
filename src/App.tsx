import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';

// Team data
const teams = {
  team1: {
    name: 'Galatasaray',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Galatasaray_Sports_Club_Logo.png',
  },
  team2: {
    name: 'Liverpool',
    logo: 'https://upload.wikimedia.org/wikipedia/hif/b/bd/Liverpool_FC.png',
  },
};

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  rotation: number;
}

interface Goal {
  angle: number;
  width: number;
  height: number;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [gameTime, setGameTime] = useState(0);
  const [score, setScore] = useState({ team1: 0, team2: 0 });
  const [gameStartTime, setGameStartTime] = useState<number | null>(null);
  const [goalEffect, setGoalEffect] = useState(false);
  const [teamLogos, setTeamLogos] = useState<{ team1: HTMLImageElement | null; team2: HTMLImageElement | null }>({ team1: null, team2: null });

  // Game constants
  const CIRCLE_RADIUS = 140;
  const GOAL_WIDTH = 25; // Reduced from 35
  const GOAL_HEIGHT = 10; // Reduced from 12
  const BALL_RADIUS = 10;
  const ROTATION_SPEED = 0.02; // Goals rotation speed
  const GRAVITY = 0.15; // Gravity force
  const SPEED_BOOST = 1.1; // Speed boost on collision
  const MAX_SPEED = 8; // Maximum speed limit

  // Game state
  const ballRef = useRef<Ball>({
    x: 0,
    y: 0,
    vx: 3,
    vy: 2,
    radius: BALL_RADIUS,
    rotation: 0,
  });
  
  const goalsRef = useRef<{ goal1: Goal; goal2: Goal }>({
    goal1: { angle: 0, width: GOAL_WIDTH, height: GOAL_HEIGHT },
    goal2: { angle: Math.PI, width: GOAL_WIDTH, height: GOAL_HEIGHT }
  });

  const resetGame = () => {
    ballRef.current = {
      x: 0,
      y: 0,
      vx: (Math.random() - 0.5) * 3,
      vy: -2, // Start with upward velocity
      radius: BALL_RADIUS,
      rotation: 0,
    };
    setScore({ team1: 0, team2: 0 });
    setGameTime(0);
    setGameStartTime(null);
    setIsPlaying(false);
    // Removed setGoalAnimation call (goalAnimation state is unused)
  };

  const normalizeAngle = (angle: number) => {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
  };

  const triggerGoalEffect = () => {
    setGoalEffect(true);
    setTimeout(() => {
      setGoalEffect(false);
    }, 500); // Duration of the effect
  };

  const checkGoal = (ball: Ball) => {
    const handleGoal = (team: 'team1' | 'team2') => {
      setScore(prev => ({ ...prev, [team]: prev[team] + 1 }));
      triggerGoalEffect();
      ballRef.current.x = 0;
      ballRef.current.y = 0;
      ballRef.current.vx = (Math.random() - 0.5) * 3;
      ballRef.current.vy = -2;
      return true;
    };

    const checkCollisionWithPosts = (goal: Goal, team: 'team1' | 'team2') => {
      const goalAngle = normalizeAngle(goal.angle);
      const ballAngle = normalizeAngle(Math.atan2(ball.y, ball.x));
      
      // Check if the ball is roughly aligned with the goal
      const angleDifference = Math.abs(ballAngle - goalAngle);
      if (angleDifference > 0.5 && angleDifference < 2 * Math.PI - 0.5) {
        return false; // Not near this goal
      }

      const postAngleOffset = Math.atan2(goal.width / 2, CIRCLE_RADIUS);
      const leftPostAngle = normalizeAngle(goal.angle + postAngleOffset);
      const rightPostAngle = normalizeAngle(goal.angle - postAngleOffset);

      // Check for goal
      // This logic handles the angle wrapping around 2*PI
      let isBetweenPosts = false;
      if (leftPostAngle > rightPostAngle) {
        if (ballAngle < leftPostAngle && ballAngle > rightPostAngle) {
          isBetweenPosts = true;
        }
      } else { // Wraps around 0/2PI
        if (ballAngle < leftPostAngle || ballAngle > rightPostAngle) {
          isBetweenPosts = true;
        }
      }

      if (isBetweenPosts) {
        return handleGoal(team);
      }

      // If not a goal, check for post collision
      const perpAngle = goal.angle + Math.PI / 2;
      const postCollisionThreshold = ball.radius + 3; // 3 is half of post line width

      const checkPost = (postSide: 'left' | 'right') => {
        const angle = postSide === 'left' ? leftPostAngle : rightPostAngle;
        const postX = Math.cos(angle) * CIRCLE_RADIUS;
        const postY = Math.sin(angle) * CIRCLE_RADIUS;
        const dist = Math.sqrt((ball.x - postX)**2 + (ball.y - postY)**2);

        if (dist < postCollisionThreshold) {
          // Collision with a post
          const normalX = Math.cos(perpAngle);
          const normalY = Math.sin(perpAngle);
          
          const dotProduct = ball.vx * normalX + ball.vy * normalY;
          ball.vx -= 2 * dotProduct * normalX;
          ball.vy -= 2 * dotProduct * normalY;

          ball.vx *= SPEED_BOOST * 0.9; // Slightly less boost than walls
          ball.vy *= SPEED_BOOST * 0.9;

          // Move ball away from post to prevent sticking
          const overlap = postCollisionThreshold - dist;
          ball.x += Math.cos(perpAngle) * overlap * (postSide === 'left' ? 1 : -1);
          ball.y += Math.sin(perpAngle) * overlap * (postSide === 'left' ? 1 : -1);
          
          return true;
        }
        return false;
      };

      if (checkPost('left') || checkPost('right')) {
        return 'post_collision';
      }
      
      return false;
    };

    // Check if ball is near the circle edge
    const distanceFromCenter = Math.sqrt(ball.x ** 2 + ball.y ** 2);
    if (distanceFromCenter > CIRCLE_RADIUS - ball.radius) {
      const goal1Result = checkCollisionWithPosts(goalsRef.current.goal1, 'team2');
      if (goal1Result) return goal1Result;

      const goal2Result = checkCollisionWithPosts(goalsRef.current.goal2, 'team1');
      if (goal2Result) return goal2Result;
    }
    
    return false;
  };

  const updatePhysics = () => {
    const ball = ballRef.current;
    
    // Apply gravity (downward force)
    ball.vy += GRAVITY;
    
    // Update position
    ball.x += ball.vx;
    ball.y += ball.vy;
    
    // Check collision with circle boundary
    const distanceFromCenter = Math.sqrt(ball.x ** 2 + ball.y ** 2);
    
    if (distanceFromCenter + ball.radius > CIRCLE_RADIUS) {
      const goalCheckResult = checkGoal(ball);
      
      if (goalCheckResult === true) {
        // Goal was scored, ball is reset, so skip rest of physics
        return;
      }
      
      if (goalCheckResult !== 'post_collision') {
        // If it's not a goal and not a post collision, it's a wall collision
        const normalX = ball.x / distanceFromCenter;
        const normalY = ball.y / distanceFromCenter;
        
        const dotProduct = ball.vx * normalX + ball.vy * normalY;
        ball.vx = ball.vx - 2 * dotProduct * normalX;
        ball.vy = ball.vy - 2 * dotProduct * normalY;
        
        ball.vx *= SPEED_BOOST;
        ball.vy *= SPEED_BOOST;
        
        const currentSpeed = Math.sqrt(ball.vx ** 2 + ball.vy ** 2);
        if (currentSpeed > MAX_SPEED) {
          ball.vx = (ball.vx / currentSpeed) * MAX_SPEED;
          ball.vy = (ball.vy / currentSpeed) * MAX_SPEED;
        }
        
        const overlap = distanceFromCenter + ball.radius - CIRCLE_RADIUS;
        ball.x -= normalX * overlap;
        ball.y -= normalY * overlap;
      }
    }
    
    // Update goals rotation
    goalsRef.current.goal1.angle += ROTATION_SPEED;
    goalsRef.current.goal2.angle += ROTATION_SPEED;
    
    // Update ball rotation
    ball.rotation += ball.vx * 0.05;
  };

  const draw = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Clear canvas with a trail effect
    ctx.fillStyle = 'rgba(26, 95, 26, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw field lines (re-draw every frame over the trail)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, CIRCLE_RADIUS, 0, 2 * Math.PI);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, 2 * Math.PI);
    ctx.stroke();

    // Draw logos behind goals
    const drawLogo = (goal: Goal, logo: HTMLImageElement | null) => {
      if (!logo) return;
      const logoSize = 80;
      const logoX = centerX + Math.cos(goal.angle) * (CIRCLE_RADIUS + 30);
      const logoY = centerY + Math.sin(goal.angle) * (CIRCLE_RADIUS + 30);
      
      ctx.save();
      ctx.translate(logoX, logoY);
      ctx.rotate(goal.angle + Math.PI / 2);
      ctx.globalAlpha = 0.15; // Faded effect
      ctx.drawImage(logo, -logoSize / 2, -logoSize / 2, logoSize, logoSize);
      ctx.restore();
    };

    drawLogo(goalsRef.current.goal1, teamLogos.team1);
    drawLogo(goalsRef.current.goal2, teamLogos.team2);
    
    // Draw goals
    const drawGoal = (goal: Goal, color: string) => {
      const goalX = centerX + Math.cos(goal.angle) * CIRCLE_RADIUS;
      const goalY = centerY + Math.sin(goal.angle) * CIRCLE_RADIUS;
      
      // Goal posts
      ctx.strokeStyle = color;
      ctx.lineWidth = 6; // Thicker posts
      ctx.lineCap = 'round';
      
      const perpAngle = goal.angle + Math.PI / 2;
      const postOffset = goal.width / 2;
      
      // Left post
      const leftX = goalX + Math.cos(perpAngle) * postOffset;
      const leftY = goalY + Math.sin(perpAngle) * postOffset;
      ctx.beginPath();
      ctx.moveTo(leftX, leftY);
      ctx.lineTo(leftX - Math.cos(goal.angle) * goal.height, leftY - Math.sin(goal.angle) * goal.height);
      ctx.stroke();
      
      // Right post
      const rightX = goalX - Math.cos(perpAngle) * postOffset;
      const rightY = goalY - Math.sin(perpAngle) * postOffset;
      ctx.beginPath();
      ctx.moveTo(rightX, rightY);
      ctx.lineTo(rightX - Math.cos(goal.angle) * goal.height, rightY - Math.sin(goal.angle) * goal.height);
      ctx.stroke();
      
      // Crossbar
      ctx.beginPath();
      ctx.moveTo(leftX - Math.cos(goal.angle) * goal.height, leftY - Math.sin(goal.angle) * goal.height);
      ctx.lineTo(rightX - Math.cos(goal.angle) * goal.height, rightY - Math.sin(goal.angle) * goal.height);
      ctx.stroke();
      
      // Goal net
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.6;
      
      // Vertical net lines
      for (let i = 1; i < 4; i++) {
        const ratio = i / 4;
        const netX1 = leftX + (rightX - leftX) * ratio;
        const netY1 = leftY + (rightY - leftY) * ratio;
        const netX2 = netX1 - Math.cos(goal.angle) * goal.height;
        const netY2 = netY1 - Math.sin(goal.angle) * goal.height;
        
        ctx.beginPath();
        ctx.moveTo(netX1, netY1);
        ctx.lineTo(netX2, netY2);
        ctx.stroke();
      }
      
      // Horizontal net lines
      for (let i = 1; i < 3; i++) {
        const ratio = i / 3;
        const netX1 = leftX - Math.cos(goal.angle) * goal.height * ratio;
        const netY1 = leftY - Math.sin(goal.angle) * goal.height * ratio;
        const netX2 = rightX - Math.cos(goal.angle) * goal.height * ratio;
        const netY2 = rightY - Math.sin(goal.angle) * goal.height * ratio;
        
        ctx.beginPath();
        ctx.moveTo(netX1, netY1);
        ctx.lineTo(netX2, netY2);
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    };
    
    drawGoal(goalsRef.current.goal1, '#ff4444');
    drawGoal(goalsRef.current.goal2, '#4444ff');
    
    // Draw ball
    const ball = ballRef.current;
    const ballScreenX = centerX + ball.x;
    const ballScreenY = centerY + ball.y;
    
    // Ball shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;
    
    // Draw soccer ball
    ctx.save();
    ctx.translate(ballScreenX, ballScreenY);
    ctx.rotate(ball.rotation);

    // White background
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(0, 0, ball.radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Black patches (Pentagons)
    ctx.fillStyle = 'black';
    const drawPentagon = (offsetX: number, offsetY: number, size: number, rotation: number) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * 2 * Math.PI + rotation;
        const x = offsetX + Math.cos(angle) * size;
        const y = offsetY + Math.sin(angle) * size;
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();
      ctx.fill();
    };

    drawPentagon(0, 0, ball.radius / 2, Math.PI / 5);
    drawPentagon(ball.radius * 0.8, ball.radius * 0.3, ball.radius / 2.5, Math.PI / 3);
    drawPentagon(-ball.radius * 0.7, -ball.radius * 0.5, ball.radius / 3, Math.PI / 10);

    ctx.restore();

    // Clear shadow for other elements
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  };

  const gameLoop = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (isPlaying) {
      updatePhysics();
      
      // Update game time (90 minutes in 45 seconds)
      if (gameStartTime) {
        const elapsed = (Date.now() - gameStartTime) / 1000; // seconds
        const gameMinutes = Math.min(90, Math.floor((elapsed / 45) * 90));
        setGameTime(gameMinutes);
        
        if (gameMinutes >= 90) {
          setIsPlaying(false);
        }
      }
    }
    
    draw(canvas, ctx);
    animationRef.current = requestAnimationFrame(gameLoop);
  };

  useEffect(() => {
    gameLoop();
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, gameStartTime]);

  useEffect(() => {
    const logo1 = new Image();
    logo1.src = teams.team1.logo;
    logo1.onload = () => {
      setTeamLogos(prev => ({ ...prev, team1: logo1 }));
    };

    const logo2 = new Image();
    logo2.src = teams.team2.logo;
    logo2.onload = () => {
      setTeamLogos(prev => ({ ...prev, team2: logo2 }));
    };
  }, []);

  const togglePlay = () => {
    if (!isPlaying && !gameStartTime) {
      setGameStartTime(Date.now());
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div className={`flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4 ${goalEffect ? 'shake' : ''}`}>
      {/* Scoreboard */}
      <div className="w-full max-w-md bg-gray-800 rounded-lg p-4 shadow-2xl mb-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 w-1/3">
            <img src={teams.team1.logo} alt={teams.team1.name} className="w-10 h-10 object-contain"/>
            <span className="font-bold text-lg hidden sm:inline">{teams.team1.name}</span>
          </div>
          <div className="text-3xl font-bold text-center">{score.team1}</div>
          <div className="text-center">
            <div className="text-sm font-semibold">
              {gameTime < 90 ? `${gameTime}'` : "90'"}
            </div>
            <div className="text-xs text-gray-400">VS</div>
          </div>
          <div className="text-3xl font-bold text-center">{score.team2}</div>
          <div className="flex items-center gap-3 w-1/3 justify-end">
            <span className="font-bold text-lg hidden sm:inline">{teams.team2.name}</span>
            <img src={teams.team2.logo} alt={teams.team2.name} className="w-10 h-10 object-contain"/>
          </div>
        </div>
      </div>

      {/* Game Canvas */}
      <div className={`relative bg-gray-800 rounded-lg p-4 shadow-2xl ${goalEffect ? 'flash' : ''}`}>
        <canvas
          ref={canvasRef}
          width={320}
          height={568}
          className="rounded-lg"
          style={{ display: 'block' }}
        />
      </div>

      {/* Game Controls */}
      <div className="flex gap-4 mt-4">
        <button
          onClick={togglePlay}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        
        <button
          onClick={resetGame}
          className="flex items-center gap-2 bg-gray-600 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
        >
          <RotateCcw size={20} />
          Reset
        </button>
      </div>

      {/* Game Instructions */}
      <div className="mt-4 max-w-sm text-center text-gray-400 text-sm">
        <p>Kaleler çember üzerinde döner. Top kalelere girerse gol!</p>
        <p className="mt-1">🔴 Team 1 vs Team 2 🔵</p>
      </div>
    </div>
  );
}

export default App;