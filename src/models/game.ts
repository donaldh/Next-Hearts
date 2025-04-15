import { DefaultEventsMap } from '@socket.io/component-emitter'
import { isProd } from 'core/env'
import { socketBroadcast } from 'core/server/socket-io'
import { Card, getShuffledCards, sortCards } from 'models/card'
import { Player, getNextPlayer, getPlayerWithHighestCard } from 'models/player'
import { Room, getRoom, saveRoom, getPlayer } from 'models/room'
import { endGameScore, strictPlay } from 'utils/consts'

export type Event =
	| 'card-played'
	| 'round-start'
	| 'turn-over'
	| 'round-over'
	| 'game-over'
	| 'hearts-broken'
	| 'queen-played'
	| 'turn-start'
	| 'swap-start'
	| 'swap-complete'

export interface PlayCardServer extends DefaultEventsMap {
	hello: (msg: { kitty: string }) => void
	'swap-cards': (msg: { cards: Card[], playerID: string }) => void
}
export interface PlayCardClient extends DefaultEventsMap {
	kitty: (msg: { hello: string }) => void
	'update-game': () => void
	'game-event': (event: Event) => void
}

// Game

export const newGame = (roomId: string) => {
	const room = getRoom(roomId)
	if (!room) return

	room.active = true
	room.gameOver = false
	room.roundCount = 0
	const { players } = room
	for (let i = 0; i < players.length; i++) {
		const p = players[i]
		p.points = 0
	}

	saveRoom(room.uniqueLink, room)

	prepareRound(roomId)
}

// Round

export const prepareRound = (roomId: string) => {
	const room = getRoom(roomId)
	if (!room) return

	console.log('Starting new game in room ' + room.uniqueLink)

	const DEBUG_END_GAME = true // && !isProd

	const { players } = room

	room.isHeartsBroken = false
	room.deck = getShuffledCards(players.length)

	// Increment round count
	room.roundCount = (room.roundCount || 0) + 1

	console.log('Round ' + room.roundCount)

	// Determine swap direction based on round count
	const swaps = [
		[], [], [],
		[ undefined, 1, 2 ],
		[ undefined, 1, 3, 2 ],
		[ undefined, 1, 4, 2, 3 ]
	]

	const roundMod = (room.roundCount % players.length)
	room.swapTarget = swaps[players.length][roundMod]

	let n = room.deck.length / players.length
	for (let i = 0; i < players.length; i++) {
		const p = players[i]
		p.playedCard = undefined
		p.isPlaying = false
		p.graveyard = []
		p.tricks = 0
		p.hand = sortCards(room.deck.slice(i * n, n + i * n))
		p.cardsToSwap = []

		if (DEBUG_END_GAME) p.hand = p.hand.slice(0,5)

		console.log('Player ' + i + ' ' + p.name + ' has ' + p.hand.length + ' cards')
	}

	if (DEBUG_END_GAME) players[0].hand[4] = 'queen_of_spades'

	saveRoom(room.uniqueLink, room)

	// If we need to swap cards, enter swap phase
	if (room.swapTarget) {
		room.swapPhase = true
		saveRoom(room.uniqueLink, room)
		socketBroadcast<PlayCardClient>('game-event', 'swap-start', room.uniqueLink)
	} else {
		setTimeout(() => startRound(room.uniqueLink), 750)
	}

	console.log('Swap target is ' + room.swapTarget)
	console.log('Swap phase is ' + room.swapPhase)

	socketBroadcast<PlayCardClient>('update-game', undefined, room.uniqueLink)
	socketBroadcast<PlayCardClient>('game-event', 'round-start', room.uniqueLink)
}

const startRound = (roomId: string) => {
	const room = getRoom(roomId)
	if (!room) return

	const { players } = room

	// Clear swap phase
	room.swapPhase = false

	let startingPlayer = room.startingPlayer
					   ? getNextPlayer(players, room.startingPlayer)
					   : players[Math.floor(Math.random() * players.length)]
	if (startingPlayer) startingPlayer.isPlaying = true
	room.startingPlayer = startingPlayer

	saveRoom(room.uniqueLink, room)

	socketBroadcast<PlayCardClient>('update-game', undefined, room.uniqueLink)
}

// Get the player who should receive cards from the source player
export const getSwapTarget = (players: readonly Player[], sourcePlayer: Player, direction: number) => {
	const playerCount = players.length
	const sourceIndex = players.findIndex(p => p.id === sourcePlayer.id)
	if (sourceIndex === -1) return null
	const targetIndex = (sourceIndex + direction) % playerCount
	console.log('Swapping ' + sourceIndex + ' to ' + targetIndex + '; [' + direction + ']')

	return players[targetIndex]
}

// Process card swapping for a player
export const processCardSwap = (roomId: string, playerID: string, cards: Card[]) => {
	const room = getRoom(roomId)
	if (!room || !room.swapPhase || !room.swapTarget) return false

	const player = getPlayer(room, playerID)
	if (!player) return false

	// Validate the cards are in the player's hand
	const validCards = cards.every(card => player.hand.includes(card))
	if (!validCards) return false

	// Store the cards to swap
	player.cardsToSwap = cards

	saveRoom(room.uniqueLink, room)

	// Check if all players have selected cards to swap
	const allPlayersReady = room.players.every(p => p.cardsToSwap && p.cardsToSwap.length === 3)

	if (allPlayersReady) {
		executeCardSwap(roomId)
	}

	return true
}

// Execute the card swap for all players
export const executeCardSwap = (roomId: string) => {
	const room = getRoom(roomId)
	if (!room || !room.swapTarget) return

	const { players } = room

	// Create a map to store the new hands
	const newHands = new Map<string, Card[]>()

	// Initialize new hands with current hands minus cards to swap
	players.forEach(player => {
		if (player.id) {
			const remainingCards = player.hand.filter(card => !player.cardsToSwap?.includes(card))
			newHands.set(player.id, [...remainingCards])
		}
	})

	// Add swapped cards to new hands
	players.forEach(player => {
		if (player.id && player.cardsToSwap) {
			const targetPlayer = getSwapTarget(players, player, room.swapTarget!)
			if (targetPlayer && targetPlayer.id) {
				const targetHand = newHands.get(targetPlayer.id) || []
				newHands.set(targetPlayer.id, [...targetHand, ...player.cardsToSwap])
			}
		}
	})

	// Update player hands
	players.forEach(player => {
		if (player.id) {
			const newHand = newHands.get(player.id)
			if (newHand) {
				player.hand = sortCards(newHand)
				player.cardsToSwap = []
			}
		}
	})

	// End swap phase
	room.swapPhase = false

	saveRoom(room.uniqueLink, room)

	socketBroadcast<PlayCardClient>('game-event', 'swap-complete', room.uniqueLink)
	socketBroadcast<PlayCardClient>('update-game', undefined, room.uniqueLink)

	// Start the round after a short delay
	setTimeout(() => startRound(room.uniqueLink), 1500)
}

// Turn

type CardType = 'hearts' | 'spades' | 'clubs' | 'diamonds'

export const isValidMove = (
	card: string,
	hand: string[],
	startingCard?: string,
	isHeartsBroken?: boolean
) => {
	if (!hand.find((c) => c === card)) return false

	const cardType = card.split('_')[2] as CardType

	const hasClubs = hand.find((c) => c.includes('_clubs'))
	const hasDiamonds = hand.find((c) => c.includes('_diamonds'))
	const hasSpades = hand.find((c) => c.includes('_spades'))
	const hasHearts = hand.find((c) => c.includes('_hearts'))

	if (!startingCard) {
		if (strictPlay) {
			return cardType !== 'hearts' || (!hasClubs && !hasDiamonds && !hasSpades) || isHeartsBroken
		}
		else {
			return true
		}
	}

	const startingCardType = startingCard.split('_')[2] as CardType

	if (cardType === startingCardType) return true

	// Can't play penalty cards on first turn
	if (strictPlay && startingCard === '2_of_clubs' &&
		(cardType === 'hearts' || card === 'queen_of_spades')) {
		return false
	}

	switch (startingCardType) {
		case 'clubs':
			return !hasClubs
		case 'diamonds':
			return !hasDiamonds
		case 'spades':
			return !hasSpades
		case 'hearts':
			return !hasHearts
		default:
			return false
	}
}

export const applyPlayedCard = (player: Player, card: Card, room?: Room) => {
	player.hand = player.hand?.filter((c) => c !== card)
	player.playedCard = card
	player.isPlaying = false

	if (room) {
		const cardType = card?.split('_')[2]

		socketBroadcast<PlayCardClient>('game-event', 'card-played', room.uniqueLink)

		if (cardType === 'hearts' && room && !room.isHeartsBroken) {
			room.isHeartsBroken = true
			socketBroadcast<PlayCardClient>('game-event', 'hearts-broken', room.uniqueLink)
		}
		if (card === 'queen_of_spades'
			// || card === 'king_of_spades'
			// || card === 'ace_of_spades'
		)
			socketBroadcast<PlayCardClient>('game-event', 'queen-played', room.uniqueLink)
	}

	return player
}

export const applyFinishedTurn = (roomId: string) => {
	const room = getRoom(roomId)
	if (!room) return

	const { players } = room

	const playerWithHighestCard = getPlayerWithHighestCard(room.players, room.startingCard)

	const turnCards = players.map((p) => p.playedCard) as Card[]

	if (playerWithHighestCard) {
		playerWithHighestCard.tricks += 1
		let score = 1
		turnCards.forEach((c) => {
			if (c === 'queen_of_spades') score -= 13
			else if (c === 'king_of_spades') score -= 10
			else if (c === 'ace_of_spades') score -= 7
			else if (c.includes('of_hearts')) score -= 1
		})
		playerWithHighestCard.score += score
		playerWithHighestCard.graveyard = playerWithHighestCard.graveyard.concat(turnCards)
	} else console.error("Couldn't find player with highest card!")

	room.playerToStartNextTurn = playerWithHighestCard

	saveRoom(room.uniqueLink, room)

	setTimeout(() => {
		socketBroadcast<PlayCardClient>('game-event', 'turn-over', room.uniqueLink)

		setTimeout(() => {
			nextTurn(room.uniqueLink)
		}, 1000)
	}, 2000)
}
export const nextTurn = (roomId: string) => {
	const room = getRoom(roomId)
	if (!room) return

	const { players } = room

	players.forEach((p) => {
		p.playedCard = undefined
		p.isPlaying = false
	})

	room.startingCard = undefined

	if (players[0].hand.length === 0) {
		players.forEach((p) => {
			let hearts = 0
			p.graveyard.forEach((c) => {
				if (c.includes('of_hearts')) hearts += 1
			})
			if (hearts === 13) p.score += 43
			p.points += p.score
			p.score = 0
		})

		console.log('Round ended: ' + JSON.stringify(room.players, null, 2))
		socketBroadcast<PlayCardClient>('game-event', 'round-over', room.uniqueLink)

		if (players.find((p) => p.points <= endGameScore)) {
			room.gameOver = true
			console.log('Game ended: ' + JSON.stringify(room.players, null, 2))
			socketBroadcast<PlayCardClient>('game-event', 'game-over', room.uniqueLink)
		} else {
			setTimeout(() => {
				prepareRound(room.uniqueLink)
			}, 7500)
		}
	} else {
		if (room.playerToStartNextTurn) room.playerToStartNextTurn.isPlaying = true
	}

	room.playerToStartNextTurn = undefined

	saveRoom(room.uniqueLink, room)

	socketBroadcast<PlayCardClient>('update-game', undefined, room.uniqueLink)
	socketBroadcast<PlayCardClient>('game-event', 'turn-start', room.uniqueLink)
}
