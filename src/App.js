import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

// Define global variables for Firebase configuration and app ID
// Leemos las variables de entorno desde process.env
const appId = process.env.REACT_APP_DEFAULT_APP_ID || 'default-app-id';
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID // Opcional
};
const initialAuthToken = null; // No necesitas un token inicial para el inicio de sesión anónimo local

// Initialize Firebase (will be done once in useEffect)
let app;
let db;
let auth;

// Data for the game (simplified for initial version)
const ordersData = [
    {
        id: 'benedictine',
        name: 'Monje Benedictino',
        description: 'Expertos en la preservación del saber y agricultura.',
        initialFe: 15,
        initialRazon: 10,
        icon: 'fas fa-book-reader' // Font Awesome icon
    },
    {
        id: 'scholastic',
        name: 'Escolástico/Profesor Universitario',
        description: 'Centrados en el avance del conocimiento y la fundación de universidades.',
        initialFe: 10,
        initialRazon: 15,
        icon: 'fas fa-graduation-cap' // Font Awesome icon
    },
    {
        id: 'missionary',
        name: 'Misionero/Defensor de la Caridad',
        description: 'Especializados en obras de caridad y hospitales.',
        initialFe: 20,
        initialRazon: 5,
        icon: 'fas fa-cross' // Font Awesome icon
    },
];

const contributionCardsData = [
    {
        id: 'fundUniversity',
        name: 'Fundar una Universidad',
        description: 'Un centro de saber crucial para la civilización.',
        costFe: 10,
        costRazon: 15,
        civilizationPoints: 50,
        quote: '“La Universidad fue un fenómeno enteramente nuevo en la historia de Europa, y procede directamente del mundo medieval, siendo desarrollada por la Iglesia.”',
        icon: 'fas fa-university'
    },
    {
        id: 'preserveManuscripts',
        name: 'Preservar Manuscritos',
        description: 'Salvaguarda el conocimiento antiguo de la ruina.',
        costFe: 8,
        costRazon: 12,
        civilizationPoints: 40,
        quote: '“Los monjes preservaron la herencia literaria del mundo antiguo, por no decir la propia existencia del alfabetismo, tras la caída del Imperio romano.”',
        icon: 'fas fa-scroll'
    },
    {
        id: 'developAgriculture',
        name: 'Desarrollar Técnicas Agrícolas',
        description: 'Mejora la producción de alimentos y la vida rural.',
        costFe: 7,
        costRazon: 10,
        civilizationPoints: 35,
        quote: '“Debemos agradecer a los monjes la recuperación de la agricultura en gran parte de Europa.”',
        icon: 'fas fa-tractor'
    },
    {
        id: 'abolishInfanticide',
        name: 'Abolir el Infanticidio',
        description: 'Pone fin a prácticas moralmente repugnantes del mundo antiguo.',
        costFe: 15,
        costRazon: 5,
        civilizationPoints: 60,
        quote: '“La Iglesia Católica puso fin a prácticas del mundo antiguo moralmente repugnantes, como el infanticidio o los combates de gladiadores.”',
        icon: 'fas fa-baby'
    },
    {
        id: 'establishHospitals',
        name: 'Establecer Hospitales',
        description: 'Crea instituciones para el cuidado de los enfermos y necesitados.',
        costFe: 12,
        costRazon: 8,
        civilizationPoints: 45,
        quote: '“La Iglesia lideró la creación de instituciones para el cuidado de los enfermos, como los Caballeros de San Juan.”',
        icon: 'fas fa-hospital'
    },
];

const mythCardsData = [
    {
        id: 'darkAgesIgnorance',
        name: 'Mito: La Edad Media fue Oscura',
        description: 'La Edad Media fue un período de ignorancia y represión.',
        reasonCost: 20,
        civilizationBonus: 100,
        requiredContributions: ['fundUniversity', 'preserveManuscripts'],
        debunkQuote: '“Hoy sabemos que la Edad Media, lejos de ser un período de oscuridad, fue una era de florecimiento intelectual y cultural, impulsado en gran medida por la Iglesia.”'
    },
    {
        id: 'churchHostileScience',
        name: 'Mito: La Iglesia vs. Ciencia',
        description: 'La Iglesia fue hostil al avance científico y suprimió el conocimiento.',
        reasonCost: 25,
        civilizationBonus: 120,
        requiredContributions: ['fundUniversity', 'establishHospitals'], // Example, could be more specific science cards
        debunkQuote: '“La Iglesia Católica-romana ha proporcionado más ayuda financiera y apoyo social al estudio de la astronomía durante seis siglos... que ninguna otra institución y probablemente más que el resto en su conjunto.”'
    },
];

// Helper component for displaying cards
const Card = ({ card, onClick, buttonText, buttonDisabled, type }) => (
    <div className={`bg-gradient-to-br from-amber-100 to-amber-200 p-4 rounded-xl shadow-lg border border-amber-300 transform transition-transform hover:scale-105 ${type === 'myth' ? 'border-red-400' : ''}`}>
        <div className="flex items-center mb-2">
            {card.icon && <i className={`${card.icon} text-amber-700 text-2xl mr-3`}></i>}
            <h3 className="font-bold text-lg text-amber-900">{card.name}</h3>
        </div>
        <p className="text-sm text-amber-800 mb-3">{card.description}</p>
        {type === 'contribution' && (
            <div className="text-xs text-amber-700 mb-3">
                <p><i className="fas fa-hand-holding-heart mr-1"></i>Fe: {card.costFe} <i className="fas fa-brain ml-2 mr-1"></i>Razón: {card.costRazon}</p>
                <p className="font-semibold mt-1"><i className="fas fa-star mr-1"></i>Puntos de Civilización: {card.civilizationPoints}</p>
            </div>
        )}
        {type === 'myth' && (
            <div className="text-xs text-amber-700 mb-3">
                <p><i className="fas fa-brain mr-1"></i>Costo de Razón para Desmentir: {card.reasonCost}</p>
                <p className="font-semibold mt-1"><i className="fas fa-star mr-1"></i>Bonificación de Civilización: {card.civilizationBonus}</p>
                <p className="text-xs mt-2 text-amber-600">Requiere: {card.requiredContributions.map(id => contributionCardsData.find(c => c.id === id)?.name || id).join(', ')}</p>
            </div>
        )}
        {onClick && (
            <button
                onClick={onClick}
                disabled={buttonDisabled}
                className={`w-full py-2 px-4 rounded-lg font-semibold transition-colors duration-200
                           ${buttonDisabled ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-amber-700 text-white hover:bg-amber-800 shadow-md hover:shadow-lg'}`}
            >
                {buttonText}
            </button>
        )}
    </div>
);

// Helper component for custom modal
const Modal = ({ isOpen, title, message, onClose, actions }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-6 rounded-xl shadow-2xl max-w-lg w-full border border-amber-300">
                <h2 className="text-2xl font-bold text-amber-900 mb-4 border-b pb-2 border-amber-300">{title}</h2>
                <p className="text-amber-800 mb-6">{message}</p>
                <div className="flex justify-end space-x-3">
                    {actions ? actions.map((action, index) => (
                        <button
                            key={index}
                            onClick={action.handler}
                            className={`py-2 px-5 rounded-lg font-semibold transition-colors duration-200 ${action.primary ? 'bg-amber-700 text-white hover:bg-amber-800' : 'bg-amber-200 text-amber-800 hover:bg-amber-300'}`}
                        >
                            {action.text}
                        </button>
                    )) : (
                        <button
                            onClick={onClose}
                            className="py-2 px-5 rounded-lg font-semibold bg-amber-700 text-white hover:bg-amber-800 transition-colors duration-200"
                        >
                            Cerrar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// Componente para la pantalla de inicio/selección de orden
const HomeScreen = ({ startGame, userId }) => {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4">
            <h1 className="text-5xl font-extrabold mb-8 text-amber-300 drop-shadow-lg text-center">
                Constructores de la Civilización
            </h1>
            <p className="text-xl text-gray-300 mb-10 text-center max-w-2xl">
                El Legado de la Iglesia: Elige una Orden para iniciar tu viaje y construir la Civilización Occidental.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-4xl">
                {ordersData.map(order => (
                    <div
                        key={order.id}
                        onClick={() => startGame(order)}
                        className="bg-gradient-to-br from-amber-700 to-amber-900 p-6 rounded-xl shadow-xl border border-amber-600 cursor-pointer transform transition-all duration-300 hover:scale-105 hover:shadow-2xl flex flex-col items-center text-center"
                    >
                        <i className={`${order.icon} text-amber-300 text-5xl mb-4`}></i>
                        <h2 className="text-2xl font-bold text-amber-100 mb-2">{order.name}</h2>
                        <p className="text-amber-200 text-sm mb-4">{order.description}</p>
                        <div className="text-amber-300 text-sm font-semibold">
                            <p><i className="fas fa-hand-holding-heart mr-1"></i>Fe Inicial: {order.initialFe}</p>
                            <p><i className="fas fa-brain mr-1"></i>Razón Inicial: {order.initialRazon}</p>
                        </div>
                    </div>
                ))}
            </div>
            {userId && <p className="text-gray-400 text-sm mt-8">ID de Usuario: {userId}</p>}
        </div>
    );
};

// Componente para la pantalla principal del juego
const GameScreen = ({
    userId, selectedOrder, fePoints, razonPoints, civilizationPoints,
    availableContributionCards, availableMythCards, playedContributions,
    playContributionCard, debunkMythCard, drawNewContributionCards, drawNewMythCards, resetGame,
    setCurrentPage, openModal // Añadimos openModal aquí para usarlo en caso de error
}) => {
    // Manejo de caso donde selectedOrder es null (ej. si se navega directamente aquí sin iniciar partida)
    if (!selectedOrder) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4">
                <h2 className="text-3xl font-bold text-red-400 mb-4">¡Error! No hay partida iniciada.</h2>
                <p className="text-xl text-gray-300 mb-8 text-center">
                    Por favor, selecciona una orden en la pantalla de inicio para comenzar tu aventura.
                </p>
                <button
                    onClick={() => setCurrentPage('home')}
                    className="bg-amber-700 text-white py-3 px-6 rounded-lg font-semibold shadow-md hover:bg-amber-800 transition-colors duration-200"
                >
                    <i className="fas fa-arrow-left mr-2"></i>Ir a la pantalla de inicio
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4 sm:p-6 lg:p-8 relative">
            {/* Header */}
            <header className="flex flex-col sm:flex-row justify-between items-center bg-amber-900 bg-opacity-70 backdrop-blur-sm rounded-xl p-4 mb-6 shadow-xl border border-amber-700">
                <h1 className="text-3xl sm:text-4xl font-extrabold text-amber-300 drop-shadow-md mb-3 sm:mb-0 text-center sm:text-left">
                    Constructores de la Civilización
                </h1>
                <div className="flex flex-wrap justify-center sm:justify-end gap-4 text-lg font-semibold">
                    <div className="bg-amber-800 rounded-full py-2 px-4 flex items-center shadow-inner">
                        <i className="fas fa-star text-amber-300 mr-2"></i>
                        <span className="text-amber-100">Civilización: {civilizationPoints}</span>
                    </div>
                    <div className="bg-amber-800 rounded-full py-2 px-4 flex items-center shadow-inner">
                        <i className="fas fa-hand-holding-heart text-amber-300 mr-2"></i>
                        <span className="text-amber-100">Fe: {fePoints}</span>
                    </div>
                    <div className="bg-amber-800 rounded-full py-2 px-4 flex items-center shadow-inner">
                        <i className="fas fa-brain text-amber-300 mr-2"></i>
                        <span className="text-amber-100">Razón: {razonPoints}</span>
                    </div>
                </div>
            </header>

            {/* Game Area */}
            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Panel: Available Contributions */}
                <section className="lg:col-span-2 bg-amber-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-amber-700">
                    <h2 className="text-2xl font-bold text-amber-200 mb-5 border-b pb-3 border-amber-700">
                        <i className="fas fa-lightbulb mr-2 text-amber-300"></i>Contribuciones Disponibles
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {availableContributionCards.map(card => (
                            <Card
                                key={card.id}
                                card={card}
                                type="contribution"
                                onClick={() => playContributionCard(card.id)}
                                buttonText="Realizar Contribución"
                                buttonDisabled={fePoints < card.costFe || razonPoints < card.costRazon}
                            />
                        ))}
                    </div>
                    <div className="mt-6 text-center">
                        <button
                            onClick={drawNewContributionCards}
                            className="bg-amber-700 text-white py-3 px-6 rounded-lg font-semibold shadow-md hover:bg-amber-800 transition-colors duration-200"
                        >
                            <i className="fas fa-sync-alt mr-2"></i>Ver Nuevas Contribuciones
                        </button>
                    </div>
                </section>

                {/* Right Panel: Myth to Debunk */}
                <aside className="lg:col-span-1 bg-amber-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-amber-700">
                    <h2 className="text-2xl font-bold text-amber-200 mb-5 border-b pb-3 border-amber-700">
                        <i className="fas fa-mask mr-2 text-amber-300"></i>Mito a Desmentir
                    </h2>
                    {availableMythCards.length > 0 ? (
                        availableMythCards.map(myth => (
                            <Card
                                key={myth.id}
                                card={myth}
                                type="myth"
                                onClick={() => debunkMythCard(myth.id)}
                                buttonText="Desmentir Mito"
                                buttonDisabled={
                                    razonPoints < myth.reasonCost ||
                                    !myth.requiredContributions.every(reqId => playedContributions.includes(reqId))
                                }
                            />
                        ))
                    ) : (
                        <p className="text-amber-300 text-center py-8">¡Todos los mitos han sido desmentidos por ahora!</p>
                    )}
                </aside>
            </main>

            {/* Footer / Game Controls */}
            <footer className="mt-6 flex flex-col sm:flex-row justify-between items-center bg-amber-900 bg-opacity-70 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-amber-700">
                <p className="text-amber-300 text-sm mb-3 sm:mb-0 text-center sm:text-left">
                    Orden Actual: <span className="font-semibold">{selectedOrder.name}</span>
                    {userId && <span className="block sm:inline-block ml-0 sm:ml-4">ID de Usuario: {userId}</span>}
                </p>
                <button
                    onClick={resetGame}
                    className="bg-red-700 text-white py-2 px-5 rounded-lg font-semibold shadow-md hover:bg-red-800 transition-colors duration-200"
                >
                    <i className="fas fa-redo mr-2"></i>Reiniciar Juego
                </button>
            </footer>
        </div>
    );
};

// Componente Placeholder para la Biblioteca
const LibraryScreen = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <h2 className="text-4xl font-extrabold text-amber-300 mb-6 text-center">
                <i className="fas fa-book-open mr-3"></i>Biblioteca de la Civilización
            </h2>
            <div className="bg-amber-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-amber-700 max-w-3xl mx-auto">
                <p className="text-amber-200 text-lg mb-4">
                    Aquí encontrarás un compendio de los conocimientos y contribuciones de la Iglesia Católica a la civilización occidental, extraídos del libro "Cómo la Iglesia Construyó la Civilización Occidental" de Thomas E. Woods.
                </p>
                <p className="text-amber-300 text-center text-xl font-semibold">
                    ¡Esta sección se expandirá con más contenido y citas a medida que avances en el juego!
                </p>
                {/* Aquí se podría renderizar el contenido dinámico de la biblioteca */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-amber-800 p-4 rounded-lg shadow-md">
                        <h3 className="font-bold text-amber-100 text-lg mb-2">Monjes Benedictinos</h3>
                        <p className="text-amber-200 text-sm">
                            "Los monjes preservaron la herencia literaria del mundo antiguo, por no decir la propia existencia del alfabetismo, tras la caída del Imperio romano."
                        </p>
                    </div>
                    <div className="bg-amber-800 p-4 rounded-lg shadow-md">
                        <h3 className="font-bold text-amber-100 text-lg mb-2">Fundación de Universidades</h3>
                        <p className="text-amber-200 text-sm">
                            "La Universidad fue un fenómeno enteramente nuevo en la historia de Europa, y procede directamente del mundo medieval, siendo desarrollada por la Iglesia."
                        </p>
                    </div>
                    {/* Más entradas de ejemplo */}
                </div>
            </div>
        </div>
    );
};

// Componente Placeholder para la sección Acerca de
const AboutScreen = () => {
    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-800 to-gray-900 text-white p-4 sm:p-6 lg:p-8">
            <h2 className="text-4xl font-extrabold text-amber-300 mb-6 text-center">
                <i className="fas fa-info-circle mr-3"></i>Acerca de este Juego
            </h2>
            <div className="bg-amber-900 bg-opacity-60 backdrop-blur-sm rounded-xl p-6 shadow-xl border border-amber-700 max-w-3xl mx-auto">
                <p className="text-amber-200 text-lg mb-4">
                    "Constructores de la Civilización: El Legado de la Iglesia" es un juego educativo inspirado en la obra "Cómo la Iglesia Construyó la Civilización Occidental" de Thomas E. Woods.
                </p>
                <p className="text-amber-200 text-lg mb-4">
                    Su objetivo es destacar las multifacéticas contribuciones de la Iglesia Católica en diversas áreas como la educación, la ciencia, el derecho, la caridad y la economía, a la vez que desmiente mitos históricos comunes sobre la Edad Media.
                </p>
                <p className="text-amber-200 text-lg">
                    Esperamos que disfrutes aprendiendo sobre este valioso legado.
                </p>
            </div>
        </div>
    );
};


export default function App() {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [gameStarted, setGameStarted] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [fePoints, setFePoints] = useState(0);
    const [razonPoints, setRazonPoints] = useState(0);
    const [civilizationPoints, setCivilizationPoints] = useState(0);
    const [playedContributions, setPlayedContributions] = useState([]);
    const [debunkedMyths, setDebunkedMyths] = useState([]);
    const [availableContributionCards, setAvailableContributionCards] = useState([]);
    const [availableMythCards, setAvailableMythCards] = useState([]);

    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalMessage, setModalMessage] = useState('');
    const [modalActions, setModalActions] = useState(null);

    // Nuevo estado para la navegación
    const [currentPage, setCurrentPage] = useState('home'); // 'home', 'game', 'library', 'about'

    const openModal = (title, message, actions = null) => {
        setModalTitle(title);
        setModalMessage(message);
        setModalActions(actions);
        setModalOpen(true);
    };

    const closeModal = () => {
        setModalOpen(false);
        setModalTitle('');
        setModalMessage('');
        setModalActions(null);
    };

    // Firebase Initialization and Authentication
    useEffect(() => {
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                    console.log("User authenticated:", user.uid);
                } else {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (error) {
                        console.error("Firebase Auth Error:", error);
                        openModal("Error de Autenticación", "No se pudo iniciar sesión. Por favor, recarga la página.");
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase Init Error:", error);
            openModal("Error de Inicialización", "No se pudo inicializar Firebase. Revisa la configuración.");
        }
    }, []);

    // Load game state from Firestore
    const loadGameState = useCallback(async (uid) => {
        if (!db) {
            console.error("Firestore DB not initialized.");
            return;
        }
        const gameDocRef = doc(db, `artifacts/${appId}/users/${uid}/game_state`, 'current_game');
        try {
            const docSnap = await getDoc(gameDocRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSelectedOrder(data.selectedOrder);
                setFePoints(data.fePoints);
                setRazonPoints(data.razonPoints);
                setCivilizationPoints(data.civilizationPoints);
                setPlayedContributions(data.playedContributions || []);
                setDebunkedMyths(data.debunkedMyths || []);
                setGameStarted(true);
                setCurrentPage('game'); // Si hay partida guardada, va directo al juego
                openModal("Partida Cargada", "Tu progreso ha sido cargado exitosamente.");
                console.log("Game state loaded:", data);
            } else {
                console.log("No existing game state found for this user.");
                setGameStarted(false); // Allow user to start a new game
                setCurrentPage('home'); // Si no hay partida, va a la pantalla de inicio
            }
        } catch (error) {
            console.error("Error loading game state:", error);
            openModal("Error al Cargar", "No se pudo cargar la partida. Intenta de nuevo.");
            setCurrentPage('home'); // En caso de error, va a la pantalla de inicio
        }
    }, []);

    // Save game state to Firestore
    const saveGameState = useCallback(async () => {
        if (userId && db && selectedOrder && gameStarted) { // Solo guarda si el juego ha iniciado
            const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/game_state`, 'current_game');
            const gameState = {
                selectedOrder,
                fePoints,
                razonPoints,
                civilizationPoints,
                playedContributions,
                debunkedMyths,
                timestamp: new Date()
            };
            try {
                await setDoc(gameDocRef, gameState);
                console.log("Game state saved successfully!");
            } catch (error) {
                console.error("Error saving game state:", error);
                openModal("Error al Guardar", "No se pudo guardar la partida automáticamente.");
            }
        }
    }, [userId, db, selectedOrder, fePoints, razonPoints, civilizationPoints, playedContributions, debunkedMyths, gameStarted]);

    // Effect to load game state once authenticated
    useEffect(() => {
        if (isAuthReady && userId) {
            loadGameState(userId);
        }
    }, [isAuthReady, userId, loadGameState]);

    // Effect to save game state whenever relevant state changes
    useEffect(() => {
        if (gameStarted) { // Only save if a game has actually started
            const handler = setTimeout(() => {
                saveGameState();
            }, 2000); // Debounce save every 2 seconds of inactivity
            return () => clearTimeout(handler);
        }
    }, [fePoints, razonPoints, civilizationPoints, playedContributions, debunkedMyths, selectedOrder, gameStarted, saveGameState]);


    // Game Logic Functions
    const startGame = (order) => {
        setSelectedOrder(order);
        setFePoints(order.initialFe);
        setRazonPoints(order.initialRazon);
        setCivilizationPoints(0);
        setPlayedContributions([]);
        setDebunkedMyths([]);
        setGameStarted(true);
        setCurrentPage('game'); // Navega a la pantalla del juego
        // Shuffle and draw initial cards
        drawNewContributionCards();
        drawNewMythCards();
        openModal("¡Juego Iniciado!", `Has elegido la Orden ${order.name}. ¡Que la civilización prospere!`);
    };

    const drawNewContributionCards = () => {
        const available = contributionCardsData.filter(card => !playedContributions.includes(card.id));
        const shuffled = available.sort(() => 0.5 - Math.random());
        setAvailableContributionCards(shuffled.slice(0, 3));
    };

    const drawNewMythCards = () => {
        const available = mythCardsData.filter(card => !debunkedMyths.includes(card.id));
        const shuffled = available.sort(() => 0.5 - Math.random());
        setAvailableMythCards(shuffled.slice(0, 1));
    };

    const playContributionCard = (cardId) => {
        const card = contributionCardsData.find(c => c.id === cardId);
        if (!card) return;

        if (fePoints >= card.costFe && razonPoints >= card.costRazon) {
            setFePoints(prev => prev - card.costFe);
            setRazonPoints(prev => prev - card.costRazon);
            setCivilizationPoints(prev => prev + card.civilizationPoints);
            setPlayedContributions(prev => [...prev, card.id]);
            openModal(card.name, `${card.quote}\n\n¡Has contribuido con ${card.civilizationPoints} Puntos de Civilización!`);
            drawNewContributionCards(); // Draw new cards after playing one
        } else {
            openModal("Recursos Insuficientes", `Necesitas ${card.costFe - fePoints} Fe y ${card.costRazon - razonPoints} Razón más para jugar esta carta.`);
        }
    };

    const debunkMythCard = (mythId) => {
        const myth = mythCardsData.find(m => m.id === mythId);
        if (!myth) return;

        const hasRequiredContributions = myth.requiredContributions.every(reqId => playedContributions.includes(reqId));

        if (razonPoints >= myth.reasonCost && hasRequiredContributions) {
            setRazonPoints(prev => prev - myth.reasonCost);
            setCivilizationPoints(prev => prev + myth.civilizationBonus);
            setDebunkedMyths(prev => [...prev, myth.id]);
            openModal("¡Mito Desmentido!", `${myth.debunkQuote}\n\nHas ganado ${myth.civilizationBonus} Puntos de Civilización por desmentir este mito.`);
            drawNewMythCards(); // Draw new myth card
        } else {
            let message = "No puedes desmentir este mito.";
            if (razonPoints < myth.reasonCost) {
                message += ` Necesitas ${myth.reasonCost - razonPoints} Razón más.`;
            }
            if (!hasRequiredContributions) {
                const missing = myth.requiredContributions.filter(reqId => !playedContributions.includes(reqId))
                    .map(id => contributionCardsData.find(c => c.id === id)?.name || id);
                message += ` Te faltan las contribuciones: ${missing.join(', ')}.`;
            }
            openModal("No se puede Desmentir", message);
        }
    };

    const resetGame = () => {
        openModal(
            "Reiniciar Juego",
            "¿Estás seguro de que quieres reiniciar la partida? Se perderá todo tu progreso actual.",
            [
                { text: "Cancelar", handler: closeModal },
                { text: "Reiniciar", handler: () => {
                    setGameStarted(false);
                    setSelectedOrder(null);
                    setFePoints(0);
                    setRazonPoints(0);
                    setCivilizationPoints(0);
                    setPlayedContributions([]);
                    setDebunkedMyths([]);
                    setAvailableContributionCards([]);
                    setAvailableMythCards([]);
                    closeModal();
                    setCurrentPage('home'); // Vuelve a la pantalla de inicio
                    // Optionally delete from Firestore
                    if (userId && db) {
                        const gameDocRef = doc(db, `artifacts/${appId}/users/${userId}/game_state`, 'current_game');
                        // deleteDoc(gameDocRef); // Uncomment if you want to explicitly delete
                    }
                }, primary: true }
            ]
        );
    };

    // Renderizado condicional de páginas
    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <HomeScreen startGame={startGame} userId={userId} />;
            case 'game':
                return (
                    <GameScreen
                        userId={userId}
                        selectedOrder={selectedOrder}
                        fePoints={fePoints}
                        razonPoints={razonPoints}
                        civilizationPoints={civilizationPoints}
                        availableContributionCards={availableContributionCards}
                        availableMythCards={availableMythCards}
                        playedContributions={playedContributions}
                        playContributionCard={playContributionCard}
                        debunkMythCard={debunkMythCard}
                        drawNewContributionCards={drawNewContributionCards}
                        drawNewMythCards={drawNewMythCards}
                        resetGame={resetGame}
                        setCurrentPage={setCurrentPage} // Pasa setCurrentPage al GameScreen
                        openModal={openModal} // Pasa openModal al GameScreen
                    />
                );
            case 'library':
                return <LibraryScreen />;
            case 'about':
                return <AboutScreen />;
            default:
                return <HomeScreen startGame={startGame} userId={userId} />;
        }
    };

    if (!isAuthReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900 text-white">
                <p className="text-xl animate-pulse">Cargando civilización...</p>
            </div>
        );
    }

    return (
        <div className="font-sans"> {/* Contenedor principal para aplicar la fuente */}
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" xintegrity="sha512-Fo3rlrZj/k7ujTnHg4CGR2D7kSs0V4LLanw2qksYuRlEzO+tcaEPQogQ0KaoGN26/zrn20ImR1DfuLWnOo7aBA==" crossOrigin="anonymous" referrerPolicy="no-referrer" />
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                {`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
                body { font-family: 'Inter', sans-serif; }
                `}
            </style>

            {/* Barra de Navegación */}
            <nav className="bg-gray-900 bg-opacity-80 backdrop-blur-sm p-4 shadow-lg flex justify-center space-x-6 text-white text-lg font-semibold sticky top-0 z-40">
                <button
                    onClick={() => setCurrentPage('home')}
                    className={`py-2 px-4 rounded-lg transition-colors duration-200 ${currentPage === 'home' ? 'bg-amber-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    <i className="fas fa-home mr-2"></i>Inicio
                </button>
                <button
                    onClick={() => {
                        if (gameStarted) {
                            setCurrentPage('game');
                        } else {
                            openModal("Partida no Iniciada", "Por favor, selecciona una orden en la pantalla de inicio para comenzar el juego.");
                            setCurrentPage('home'); // Asegura que el usuario vea la pantalla de inicio
                        }
                    }}
                    className={`py-2 px-4 rounded-lg transition-colors duration-200 ${currentPage === 'game' ? 'bg-amber-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    <i className="fas fa-dice-d20 mr-2"></i>Juego
                </button>
                <button
                    onClick={() => setCurrentPage('library')}
                    className={`py-2 px-4 rounded-lg transition-colors duration-200 ${currentPage === 'library' ? 'bg-amber-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    <i className="fas fa-book mr-2"></i>Biblioteca
                </button>
                <button
                    onClick={() => setCurrentPage('about')}
                    className={`py-2 px-4 rounded-lg transition-colors duration-200 ${currentPage === 'about' ? 'bg-amber-700 text-white' : 'hover:bg-gray-700 text-gray-300'}`}
                >
                    <i className="fas fa-info-circle mr-2"></i>Acerca de
                </button>
            </nav>

            {/* Contenido de la página actual */}
            {renderPage()}

            <Modal isOpen={modalOpen} title={modalTitle} message={modalMessage} onClose={closeModal} actions={modalActions} />
        </div>
    );
}
