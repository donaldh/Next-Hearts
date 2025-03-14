import { v1 } from 'uuid'
import { Card, sortCards } from './card'

export type Player = {
	id?: string
	publicID?: string
	name: string
	score: number
	points: number
	seat: number
	isPlaying?: boolean
	playedCard?: Card
	hand: Card[]
	graveyard: Card[]
	// Client only
	isLocal?: boolean
}

export const getNextPlayer = (players: readonly Player[], player?: Player) => {
	let lastPlayer = players.length - 1
	const lastSeatPlayer = players.find((p) => p.seat === lastPlayer)
	const seat = player?.seat || 0
	return seat - 1 < 0 ? lastSeatPlayer : players.find((p) => p.seat === seat - 1)
}
export const getPreviousPlayer = (players: Player[], player?: Player) => {
	let lastPlayer = players.length - 1
	const firstSeatPlayer = players.find((p) => p.seat === 0)
	const seat = player?.seat || 0
	return seat + 1 > lastPlayer ? firstSeatPlayer : players.find((p) => p.seat === seat + 1)
}

export const getPlayerWithHighestCard = (players: readonly Player[], startingCard?: Card) => {
	const playedCards = sortCards(players.map((p) => p.playedCard as Card))
	const startingType = startingCard?.split('_')[2]

	let highestCard = players[0].playedCard
	playedCards.forEach((card) => {
		const cardType = card?.split('_')[2]

		if (cardType !== startingType) return

		highestCard = card
	})

	return players.find((p) => p.playedCard === highestCard)
}

// Client only

export const getPlayerID = () => {
	let newPlayerID = v1()
	const key = 'player-id'
	try {
		const item = localStorage.getItem(key)
		if (item && item !== 'undefined') {
			return item
		}

		localStorage.setItem(key, newPlayerID)
		return newPlayerID
	} catch {
		return newPlayerID
	}
}
