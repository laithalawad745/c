// components/game/NegotiationSystem.tsx
'use client';

import React, { useState, useEffect } from 'react';
import SocketClient from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';

interface NegotiationSystemProps {
  roomId: string;
  playerName: string;
  playerPart: string;
  isLeader: boolean;
  players: any[];
  collectedParts: any[];
  onNearbyPlayerChange?: (player: any) => void;
}

export default function NegotiationSystem({ 
  roomId, 
  playerName, 
  playerPart, 
  isLeader, 
  players,
  collectedParts = [],
  onNearbyPlayerChange
}: NegotiationSystemProps) {
  const [nearbyPlayers, setNearbyPlayers] = useState<Set<string>>(new Set());
  const [negotiationRequest, setNegotiationRequest] = useState<any>(null);
  const [showNegotiationDialog, setShowNegotiationDialog] = useState(false);
  const [canAssemble, setCanAssemble] = useState(false);
  const [assemblyResult, setAssemblyResult] = useState<any>(null);
  const [eliminationChoice, setEliminationChoice] = useState(false);
  const [gameMessage, setGameMessage] = useState('');
  const [distanceWarning, setDistanceWarning] = useState(''); // للتنبيه عن البُعد

  useEffect(() => {
    // Listen for nearby players update from Game3D
    SocketClient.on('nearby-players-update', (nearbyPlayerIds: string[]) => {
      setNearbyPlayers(new Set(nearbyPlayerIds));
    });

    // Listen for negotiation requests
    SocketClient.on('negotiation-request', (data) => {
      console.log('Received negotiation request:', data);
      setNegotiationRequest(data);
      setShowNegotiationDialog(true);
    });

    // Listen for part collected
    SocketClient.on('part-collected', (data) => {
      console.log('Part collected:', data);
      showMessage(`✅ تم جمع قطعة من ${data.fromPlayerName}`);
    });

    // Listen for assembly result
    SocketClient.on('assembly-result', (result) => {
      console.log('Assembly result:', result);
      setAssemblyResult(result);
      if (result.success) {
        showMessage('🎉 نجح التجميع! السيارة اكتملت!');
      } else {
        showMessage('💔 فشل التجميع! هناك قطع معطوبة!');
      }
    });

    // Listen for elimination choice (for leader)
    SocketClient.on('choose-elimination', ({ alivePlayers }) => {
      if (isLeader) {
        setEliminationChoice(true);
      }
    });

    // Listen for being eliminated
    SocketClient.on('eliminated', ({ message }) => {
      showMessage(`❌ ${message}`);
    });

    // Listen for next round
    SocketClient.on('next-round', (gameState) => {
      showMessage(`🔄 الجولة ${gameState.roundNumber} بدأت!`);
      setAssemblyResult(null);
      setNearbyPlayers(new Set()); // Reset nearby players
    });

    // Listen for game over
    SocketClient.on('game-over', ({ winners }) => {
      const winnerNames = winners.map((w: any) => w.name).join(' و ');
      showMessage(`🏆 انتهت اللعبة! الفائزون: ${winnerNames}`);
    });

    return () => {
      SocketClient.off('nearby-players-update');
      SocketClient.off('negotiation-request');
      SocketClient.off('part-collected');
      SocketClient.off('assembly-result');
      SocketClient.off('choose-elimination');
      SocketClient.off('eliminated');
      SocketClient.off('next-round');
      SocketClient.off('game-over');
    };
  }, [isLeader]);

  // Check if can assemble (for leader)
  useEffect(() => {
    if (isLeader && collectedParts.length >= players.filter(p => p.isAlive).length - 1) {
      setCanAssemble(true);
    } else {
      setCanAssemble(false);
    }
  }, [collectedParts, players, isLeader]);

  const initiateNegotiation = (targetPlayer: any) => {
    // تحقق من قرب اللاعب
    const isNearby = nearbyPlayers.has(targetPlayer.id);
    
    if (!isNearby) {
      // إظهار تنبيه فقط - لا نخرج اللاعب
      showDistanceWarning(`⚠️ ${targetPlayer.name} بعيد جداً! اقترب منه أولاً`);
      return; // إيقاف العملية هنا
    }
    
    console.log('Initiating negotiation with:', targetPlayer.name);
    SocketClient.emit('negotiate', {
      roomId,
      targetPlayerId: targetPlayer.id
    });
    showMessage(`📤 طلبت القطعة من ${targetPlayer.name}`);
  };

  const respondToNegotiation = (givePart: boolean, isGenuine: boolean) => {
    if (!negotiationRequest) return;
    
    console.log('Responding to negotiation:', { givePart, isGenuine });
    SocketClient.emit('negotiation-response', {
      roomId,
      fromPlayerId: negotiationRequest.fromPlayerId,
      givePart,
      isGenuine
    });
    
    setShowNegotiationDialog(false);
    setNegotiationRequest(null);
    
    if (givePart) {
      showMessage(isGenuine ? '✅ أعطيت قطعة صحيحة' : '😈 أعطيت قطعة معطوبة');
    } else {
      showMessage('❌ رفضت إعطاء القطعة');
    }
  };

  const assembleCar = () => {
    console.log('Assembling car...');
    SocketClient.emit('assemble-car', roomId);
  };

  const eliminatePlayer = (playerId: string) => {
    console.log('Eliminating player:', playerId);
    SocketClient.emit('eliminate-player', {
      roomId,
      eliminatedPlayerId: playerId
    });
    setEliminationChoice(false);
  };

  const showMessage = (msg: string) => {
    setGameMessage(msg);
    setTimeout(() => setGameMessage(''), 5000);
  };

  const showDistanceWarning = (msg: string) => {
    setDistanceWarning(msg);
    setTimeout(() => setDistanceWarning(''), 3000);
  };

  const getPartEmoji = (part: string) => {
    const emojis: Record<string, string> = {
      chassis: '🏗️',
      engine: '⚙️',
      gearbox: '🔧',
      wheel: '🛞'
    };
    return emojis[part] || '❓';
  };

  const getPartName = (part: string) => {
    const names: Record<string, string> = {
      chassis: 'الهيكل',
      engine: 'المحرك',
      gearbox: 'القير',
      wheel: 'الدولاب'
    };
    return names[part] || part;
  };

  return (
    <>
      {/* Distance Warning Popup */}
      <AnimatePresence>
        {distanceWarning && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50"
          >
            <div className="bg-orange-500/90 text-white px-8 py-4 rounded-2xl shadow-2xl backdrop-blur-sm border-2 border-orange-400">
              <p className="text-xl font-bold text-center">{distanceWarning}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Game Messages */}
      <AnimatePresence>
        {gameMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="bg-black/80 text-white px-6 py-3 rounded-lg shadow-lg">
              <p className="text-lg font-bold">{gameMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Leader Controls */}
      {isLeader && (
        <div className="fixed bottom-4 right-4 z-40">
          <div className="bg-black/70 backdrop-blur rounded-lg p-4 space-y-3">
            <h3 className="text-white font-bold mb-2">🎯 أدوات القائد</h3>
            
            {/* Players list for negotiation */}
            <div className="space-y-2">
              <p className="text-gray-300 text-sm">اللاعبون:</p>
              {players.filter(p => p.isAlive && p.id !== SocketClient.id).map(player => {
                const isNearby = nearbyPlayers.has(player.id);
                const alreadyCollected = collectedParts.some(cp => cp.playerId === player.id);
                
                return (
                  <button
                    key={player.id}
                    onClick={() => initiateNegotiation(player)}
                    className={`w-full px-3 py-2 rounded-lg text-sm transition-all flex items-center justify-between ${
                      alreadyCollected 
                        ? 'bg-gray-600 cursor-not-allowed opacity-50'
                        : isNearby 
                          ? 'bg-green-600 hover:bg-green-700 text-white'
                          : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    }`}
                    disabled={alreadyCollected}
                  >
                    <span className="flex items-center gap-2">
                      {player.name}
                      {!isNearby && !alreadyCollected && <span className="text-xs">📍 بعيد</span>}
                    </span>
                    {alreadyCollected ? (
                      <span className="text-green-400">✅</span>
                    ) : (
                      <span>{isNearby ? '🤝' : '🚶'}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Collected parts */}
            {collectedParts.length > 0 && (
              <div className="bg-black/50 rounded p-2">
                <p className="text-gray-300 text-sm mb-1">القطع المجمعة:</p>
                <div className="flex gap-2">
                  {collectedParts.map((part, i) => (
                    <div key={i} className="text-2xl" title={getPartName(part.part)}>
                      {getPartEmoji(part.part)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Assemble button */}
            {canAssemble && (
              <button
                onClick={assembleCar}
                className="w-full py-3 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white font-bold rounded-lg transition-all animate-pulse"
              >
                🔧 تجميع السيارة
              </button>
            )}
          </div>
        </div>
      )}

      {/* Negotiation Dialog (for non-leaders) */}
      <AnimatePresence>
        {showNegotiationDialog && negotiationRequest && !isLeader && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 20 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-2xl font-bold mb-4 text-center">
                طلب تفاوض 🤝
              </h3>
              
              <div className="text-center mb-6">
                <p className="text-lg mb-2">
                  <span className="font-bold">{negotiationRequest.fromPlayerName}</span> (القائد)
                </p>
                <p className="text-gray-600">يريد قطعتك!</p>
                <div className="mt-4 text-4xl">
                  {getPartEmoji(playerPart)}
                </div>
                <p className="text-sm text-gray-500 mt-1">{getPartName(playerPart)}</p>
              </div>
              
              <div className="space-y-3">
                <button
                  onClick={() => respondToNegotiation(true, true)}
                  className="w-full py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>✅</span>
                  <span>إعطاء قطعة صحيحة</span>
                </button>
                
                <button
                  onClick={() => respondToNegotiation(true, false)}
                  className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>😈</span>
                  <span>إعطاء قطعة معطوبة</span>
                </button>
                
                <button
                  onClick={() => respondToNegotiation(false, false)}
                  className="w-full py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <span>❌</span>
                  <span>رفض الطلب</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Elimination Choice Dialog */}
      <AnimatePresence>
        {eliminationChoice && assemblyResult && !assemblyResult.success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              className="bg-red-900 rounded-2xl p-6 max-w-md w-full mx-4"
            >
              <h3 className="text-2xl font-bold text-white mb-4 text-center">
                ⚠️ فشل التجميع!
              </h3>
              <p className="text-white mb-4 text-center">
                اختر لاعباً للاستبعاد:
              </p>
              <div className="space-y-2">
                {players.filter(p => p.isAlive && p.id !== SocketClient.id).map(player => (
                  <button
                    key={player.id}
                    onClick={() => eliminatePlayer(player.id)}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all"
                  >
                    {player.name}
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}