import {
	DndContext,
	DragEndEvent,
	DragOverEvent,
	DragOverlay,
	DragStartEvent,
	MouseSensor,
	TouchSensor,
	pointerWithin,
	useSensor,
	useSensors,
} from '@dnd-kit/core'
import { snapCenterToCursor } from '@dnd-kit/modifiers'
import { PageWrapper } from 'components/PageWrapper'
import { PlayingCard } from 'components/PlayingCard'
import { request, useApi, useQueryParams } from 'core/client/api'
import type { NextPage } from 'next'
import { Body as GameBody, Response as GameResponse, Query, QuerySchema } from 'pages/api/game'
import { Dispatch, SetStateAction, useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@heroui/react'

import { Body as PlayCardBody, Response as PlayCardResponse } from './api/play-card'

import { CardAreas } from 'components/CardAreas'
import { useJoinRoom } from 'components/JoinRoom'
import { PlayerHand } from 'components/PlayerHand'
import { useScoreboard } from 'components/Scoreboard'
import { WaitingForPlayers } from 'components/WaitingForPlayers'
import { useSocketChannel } from 'core/client/socket-io'
import { Card } from 'models/card'
import { Event, PlayCardClient, PlayCardServer, applyPlayedCard } from 'models/game'
import { getPlayerID, getPlayerWithHighestCard } from 'models/player'
import { Body as SwapCardsBody, Response as SwapCardsResponse } from './api/swap-cards'
import { playSound } from 'utils/client'

export const localPlayerArea = 'player_1_area'

export type Animation = 'get-cards' | 'swap-cards'

const gameEvent = ({
	event,
	setAnimation,
	showScoreboard,
}: {
	event: Event
	setAnimation: Dispatch<SetStateAction<Animation | undefined>>
	showScoreboard: () => void
}) => {
	switch (event) {
		case 'card-played':
			playSound('play')
			return
		case 'turn-over':
			setAnimation('get-cards')
			playSound('turn_end')
			return
		case 'turn-start':
			setAnimation(undefined)
			return
		case 'round-over':
			showScoreboard()
			return
		case 'hearts-broken':
			playSound('break')
			return
		case 'queen-played':
			playSound('secret')
			return
		case 'round-start':
			playSound('got_cards')
			return
		case 'swap-start':
			setAnimation(undefined)
			playSound('got_cards')
			return
		case 'swap-complete':
			playSound('turn_end')
			return
	}
}

const Game: NextPage = () => {
	const playerID = useMemo(() => getPlayerID(), [])

	const { query, queryReady } = useQueryParams(QuerySchema)
	const { data, refetch, error } = useApi<GameResponse, Query, GameBody>({
		path: 'game',
		query,
		body: { playerID },
	})
	const players = useMemo(() => data?.players || [], [data?.players])
	const localPlayer = useMemo(() => players.find((p) => p.isLocal), [players])

	const playCard = useCallback(
		async (body: PlayCardBody) => {
			const { result, error } = await request<PlayCardResponse, Query, PlayCardBody>({
				path: 'play-card',
				query: query,
				body: body,
			})
			if (error) alert(error.message)

			return result
		},
		[query]
	)

	//

	const [socket] = useSocketChannel<PlayCardServer, PlayCardClient>({
		connect: () => refetch(),
		kitty: (msg) => console.log('hello from server: ' + JSON.stringify(msg)),
		'update-game': () => refetch(),
		'game-event': (event) => gameEvent({ event, setAnimation, showScoreboard }),
	})

	const [animation, setAnimation] = useState<Animation>()
	const [dragHoverArea, setDragHoverArea] = useState<string>()
	const [draggingCard, setDraggingCard] = useState<Card>()
	const [selectedCards, setSelectedCards] = useState<Card[]>([])
	const [confirmingSwap, setConfirmingSwap] = useState(false)

	const interactive = useMemo(
		() => (localPlayer?.isPlaying && !animation) || (data?.swapPhase && !animation),
		[localPlayer, animation, data?.swapPhase]
	)
	const swapPhase = useMemo(
		() => data?.swapPhase,
		[data?.swapPhase]
	)

	const swapCards = useCallback(
		async (cards: Card[]) => {
			if (!data?.swapPhase || !playerID) return

			// Check if the player has already submitted cards
			const localPlayerHasSubmitted = localPlayer?.cardsToSwap && localPlayer.cardsToSwap.length === 3
			if (localPlayerHasSubmitted) {
				// Player has already submitted cards, don't submit again
				return
			}

			setConfirmingSwap(false) // Reset confirmation state

			const { error } = await request<SwapCardsResponse, Query, SwapCardsBody>({
				path: 'swap-cards',
				query: query,
				body: { playerID, cards },
			})

			if (error) alert(error.message)
			else {
				// Update local state to show selected cards
				await refetch(
					{
						...data,
						players: players?.map((p) => {
							if (!p.isLocal) return p
							return { ...p, cardsToSwap: cards }
						}),
					},
					false
				)
			}
		},
		[data, playerID, query, players, refetch, localPlayer]
	)

	// Handle card selection during swap phase
	const handleCardSelection = useCallback(
		async (card: Card) => {
			if (!data?.swapPhase || !localPlayer) return

			// Check if the player has already submitted cards
			const localPlayerHasSubmitted = localPlayer.cardsToSwap && localPlayer.cardsToSwap.length === 3
			if (localPlayerHasSubmitted) return

			// Verify the card is in the player's hand
			if (!localPlayer.hand.includes(card)) return

			const newSelectedCards = [...selectedCards]
			const cardIndex = newSelectedCards.indexOf(card)

			if (cardIndex >= 0) {
				// Deselect the card
				newSelectedCards.splice(cardIndex, 1)
				setConfirmingSwap(false) // Reset confirmation when changing selection
			} else if (newSelectedCards.length < 3) {
				// Select the card if we haven't selected 3 yet
				newSelectedCards.push(card)
				// Enable confirmation button when exactly 3 cards are selected
				setConfirmingSwap(newSelectedCards.length === 3)
			}

			setSelectedCards(newSelectedCards)
		},
		[data?.swapPhase, localPlayer, selectedCards]
	)

	const handleDragEnd = useCallback(
		async ({ active, over }: DragEndEvent) => {
			if (!interactive) return

			setDraggingCard(undefined)

			if (localPlayer) {
				const card = active.id.toString() as Card
				const willPlayCard = over?.id.toString() === localPlayerArea

				if (data?.swapPhase) {
					await handleCardSelection(card)
				} else if (willPlayCard && card) {
					// Normal play card logic
					const playedCards = (players?.map((p) => p.playedCard).length || 0) + 1
					const playerWithHighestCard =
						playedCards === 4 && data?.startingCard
							? getPlayerWithHighestCard(players, data.startingCard)
							: undefined

					// Update cache with prediction of what the server will send but don't refetch yet
					await refetch(
						{
							...data,
							players: players?.map((p) => {
								if (!p.isLocal) return p

								return applyPlayedCard(p, card)
							}),
							playerToStartNextTurn: playerWithHighestCard?.publicID,
						},
						false
					)

					await playCard({ playerID, card })
				}
			}
		},
		[data, interactive, localPlayer, playCard, playerID, players, refetch, handleCardSelection]
	)

	const sensors = useSensors(useSensor(MouseSensor), useSensor(TouchSensor))

	const [scoreboard, showScoreboard] = useScoreboard({
		players,
		gameOver: !!data?.gameOver,
		roomID: query?.room,
	})

	const [joinRoom, showJoinRoom] = useJoinRoom(
		playerID,
		() => refetch(),
		query?.room,
		players?.length !== 0
	)
	useEffect(() => {
		const create = queryReady && !query?.room
		const join = error
		if (create || join) {
			showJoinRoom()
		}
	}, [error, queryReady, query, showJoinRoom])

	return (
		<PageWrapper>
			{scoreboard()}
			{joinRoom()}
			<WaitingForPlayers roomID={query?.room} players={players} active={data?.playing === false } />

			{data?.swapPhase && (
				<div className="fixed top-0 left-0 w-full bg-primary text-white p-2 text-center z-50 flex justify-between items-center">
					<div className="w-full text-center">
						Pass 3 cards {data.swapMessage}
						{localPlayer?.cardsToSwap && localPlayer.cardsToSwap.length === 3
							? ' (Cards submitted - waiting for other players)'
							: ` (${selectedCards.length}/3 selected)`
						}
					</div>
					<div className="flex justify-end pr-2">
						<Button
						  isDisabled={!confirmingSwap}
						  className="bg-white text-primary px-4 py-1 rounded-md"
						  onPress={() => swapCards(selectedCards)}
						>
							Confirm
						</Button>
					</div>
				</div>
			)}

			<div className={`select-none${!interactive ? ' pointer-events-none' : ''}`}>
				<DndContext
					collisionDetection={pointerWithin}
					sensors={sensors}
					onDragStart={({ active }: DragStartEvent) => {
						if (!interactive) return
						if (swapPhase) return

						const card = active.id.toString() as Card
						setDraggingCard(card)

						// For swap phase, immediately handle card selection on drag start
						if (swapPhase) {
							handleCardSelection(card)
						}
					}}
					onDragEnd={handleDragEnd}
					onDragOver={({ over }: DragOverEvent) => {
						if (!interactive) return
						setDragHoverArea(over?.id.toString())
					}}
				>
					<CardAreas
						players={players}
						localPlayer={localPlayer}
						animation={animation}
						playerToStartNextTurn={data?.playerToStartNextTurn}
					/>

					<div onClick={(e) => {
						// Handle direct clicks on cards during swap phase
						if (data?.swapPhase && interactive) {
							const target = e.target as HTMLElement;
							const cardElement = target.closest('[data-card-id]');
							if (cardElement) {
								const cardId = cardElement.getAttribute('data-card-id') as Card;
								if (cardId) {
									handleCardSelection(cardId);
								}
							}
						}
					}}>
						<PlayerHand
							interactive={interactive}
							localPlayer={localPlayer}
							startingCard={data?.startingCard}
							draggingCard={draggingCard}
							isHeartsBroken={data?.isHeartsBroken}
							swapPhase={swapPhase}
							selectedCards={selectedCards}
						/>
					</div>

					<DragOverlay modifiers={[snapCenterToCursor]}>
						{draggingCard ? (
							<PlayingCard
								isHovering={dragHoverArea === localPlayerArea}
								isOverlay
								key={draggingCard}
								id={draggingCard}
							/>
						) : null}
					</DragOverlay>
				</DndContext>
			</div>
		</PageWrapper>
	)
}

export default Game
